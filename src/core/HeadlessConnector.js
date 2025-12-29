const WebSocket = require('ws');
const XMLHttpRequest = require('xhr2');
const config = require('../config');

class HeadlessConnector {
  constructor(token, options = {}) {
    this.token = token;
    this.roomName = options.roomName || 'Haxball Room';
    this.maxPlayers = options.maxPlayers || 8;
    this.public = options.public !== false;
    this.password = options.password || null;
    this.noPlayer = options.noPlayer !== false;
    
    this.ws = null;
    this.roomLink = null;
    this.connected = false;
    this.initialized = false;
    
    this.callbacks = {
      onRoomLink: null,
      onPlayerJoin: null,
      onPlayerLeave: null,
      onPlayerChat: null,
      onGameStart: null,
      onGameStop: null,
      onTeamGoal: null,
      onPlayerBallKick: null,
      onPositionsReset: null,
    };
    
    this.players = new Map();
    this.room = {
      playerList: [],
      scores: { red: 0, blue: 0 },
      inProgress: false,
    };
  }

  async requestHostInfo() {
    return new Promise((resolve, reject) => {
      console.log('[headless] Requesting host info from Haxball API...');
      
      const xhr = new XMLHttpRequest();
      const url = 'https://www.haxball.com/api/host';
      const postData = `token=${encodeURIComponent(this.token)}`;
      
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      
      xhr.onload = () => {
        try {
          console.log('[headless] API Response status:', xhr.status);
          if (xhr.status !== 200) {
            console.error('[headless] API Error:', xhr.status, xhr.statusText);
            throw new Error(`API returned ${xhr.status}: ${xhr.statusText}`);
          }
          
          const response = JSON.parse(xhr.responseText);
          console.log('[headless] Got host info successfully');
          resolve(response);
        } catch (err) {
          console.error('[headless] Parse error:', err.message);
          console.error('[headless] Response text (first 300 chars):', xhr.responseText.substring(0, 300));
          reject(err);
        }
      };
      
      xhr.onerror = () => {
        reject(new Error(`XHR error: ${xhr.status}`));
      };
      
      xhr.send(postData);
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.requestHostInfo().then(hostInfo => {
        if (!hostInfo.url || !hostInfo.token) {
          reject(new Error('Invalid host info response: missing url or token'));
          return;
        }
        
        const wsUrl = hostInfo.url + '?token=' + encodeURIComponent(hostInfo.token);
        
        console.log('[headless] Connecting to WebSocket at:', hostInfo.url.split('/').slice(0, 3).join('/') + '...');
        
        try {
          // Connect with proper origin header (required by Haxball)
          this.ws = new WebSocket(wsUrl, {
            headers: {
              origin: 'https://html5.haxball.com'
            }
          });
          
          this.ws.binaryType = 'arraybuffer';
          
          this.ws.on('open', () => {
            console.log('[headless] WebSocket connected to Haxball Headless');
            this.connected = true;
            this.createRoom();
          });

          this.ws.on('message', (data) => {
            this.handleMessage(data);
          });

          this.ws.on('error', (err) => {
            console.error('[headless] WebSocket error:', err.message);
            reject(err);
          });

          this.ws.on('close', () => {
            console.log('[headless] WebSocket closed');
            this.connected = false;
            this.initialized = false;
          });

          // Timeout для подключения
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 30000);

          const checkInit = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInit);
              clearTimeout(timeout);
              resolve(this);
            }
          }, 100);
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      const type = msg.c;

      switch (type) {
        case 1:
          this.handleRoomInit(msg);
          break;
        case 2:
          this.handlePlayerJoin(msg);
          break;
        case 3:
          this.handlePlayerLeave(msg);
          break;
        case 4:
          this.handlePlayerChat(msg);
          break;
        case 5:
          this.handleGameStart(msg);
          break;
        case 6:
          this.handleGameStop(msg);
          break;
        case 7:
          this.handleTeamGoal(msg);
          break;
        case 8:
          this.handlePlayerBallKick(msg);
          break;
        case 9:
          this.handlePositionsReset(msg);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('[headless] Error handling message:', err.message);
    }
  }

  createRoom() {
    const roomMsg = {
      c: 1,
      roomName: this.roomName,
      maxPlayers: this.maxPlayers,
      public: this.public,
      password: this.password,
      noPlayer: this.noPlayer,
    };
    this.send(roomMsg);
  }

  handleRoomInit(msg) {
    console.log('[headless] Room initialized');
    this.roomLink = msg.roomLink;
    this.initialized = true;
    
    if (this.callbacks.onRoomLink) {
      this.callbacks.onRoomLink(this.roomLink);
    }
  }

  handlePlayerJoin(msg) {
    const player = msg.player;
    console.log('[headless] Player joined:', player.name);
    this.players.set(player.id, player);
    this.room.playerList.push(player);
    
    if (this.callbacks.onPlayerJoin) {
      this.callbacks.onPlayerJoin(player);
    }
  }

  handlePlayerLeave(msg) {
    const playerId = msg.playerId;
    const player = this.players.get(playerId);
    console.log('[headless] Player left:', player?.name || playerId);
    this.players.delete(playerId);
    this.room.playerList = this.room.playerList.filter(p => p.id !== playerId);
    
    if (this.callbacks.onPlayerLeave) {
      this.callbacks.onPlayerLeave(player);
    }
  }

  handlePlayerChat(msg) {
    const player = this.players.get(msg.playerId);
    console.log('[headless] Chat from', player?.name || msg.playerId, ':', msg.message);
    
    if (this.callbacks.onPlayerChat) {
      this.callbacks.onPlayerChat({
        player,
        message: msg.message,
      });
    }
  }

  handleGameStart(msg) {
    console.log('[headless] Game started');
    this.room.inProgress = true;
    
    if (this.callbacks.onGameStart) {
      this.callbacks.onGameStart(msg.byPlayer);
    }
  }

  handleGameStop(msg) {
    console.log('[headless] Game stopped');
    this.room.inProgress = false;
    this.room.scores = msg.scores || { red: 0, blue: 0 };
    
    if (this.callbacks.onGameStop) {
      this.callbacks.onGameStop(msg);
    }
  }

  handleTeamGoal(msg) {
    console.log('[headless] Goal by team', msg.team);
    this.room.scores[msg.team === 'red' ? 'red' : 'blue']++;
    
    if (this.callbacks.onTeamGoal) {
      this.callbacks.onTeamGoal(msg.team, this.room.scores);
    }
  }

  handlePlayerBallKick(msg) {
    if (this.callbacks.onPlayerBallKick) {
      this.callbacks.onPlayerBallKick(msg);
    }
  }

  handlePositionsReset(msg) {
    if (this.callbacks.onPositionsReset) {
      this.callbacks.onPositionsReset();
    }
  }

  // Room API
  setDefaultStadium(stadium) {
    this.send({ c: 10, stadium });
  }

  setCustomStadium(stadiumObj) {
    this.send({ c: 11, stadium: stadiumObj });
  }

  setScoreLimit(limit) {
    this.send({ c: 12, limit });
  }

  setTimeLimit(limit) {
    this.send({ c: 13, limit });
  }

  startGame() {
    this.send({ c: 20 });
  }

  stopGame() {
    this.send({ c: 21 });
  }

  setPlayerAdmin(playerId, admin) {
    this.send({ c: 30, playerId, admin });
  }

  setPlayerTeam(playerId, team) {
    this.send({ c: 31, playerId, team });
  }

  kickPlayer(playerId, reason, ban) {
    this.send({ c: 32, playerId, reason, ban });
  }

  sendChat(message) {
    this.send({ c: 40, message });
  }

  getPlayerList() {
    return this.room.playerList;
  }

  getScores() {
    return this.room.scores;
  }

  isInProgress() {
    return this.room.inProgress;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = HeadlessConnector;
