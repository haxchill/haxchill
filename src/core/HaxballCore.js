const config = require('../config');
const express = require('express');
const HaxballJS = require('haxball.js');

const botStatus = {
  up: false,
  roomLink: null,
  players: 0,
  inProgress: false,
  lastUpdate: null,
};

function startHealthServer() {
  const app = express();
  const port = parseInt(process.env.HEALTH_PORT || '3000', 10);
  app.get('/health', (req, res) => {
    res.json({ ok: botStatus.up, status: botStatus });
  });
  app.get('/status', (req, res) => {
    res.json(botStatus);
  });
  app.get('/room', (req, res) => {
    res.json({ roomLink: botStatus.roomLink });
  });
  app.listen(port, () => {
    console.log('[core] Health server listening on port', port);
  });
}

async function startHeadless(db) {
  if (!config.HEADLESS_TOKEN) {
    throw new Error('HEADLESS_TOKEN is missing');
  }

  console.log('[core] Initializing HaxballJS...');
  const HBInit = await HaxballJS();
  
  console.log('[core] Creating room...');
  const room = HBInit({
    roomName: config.ROOM?.name || 'HaxChill Room',
    maxPlayers: Number(config.ROOM?.maxPlayers ?? 8),
    public: config.ROOM?.public !== false,
    password: config.ROOM?.password || null,
    noPlayer: true,
    token: config.HEADLESS_TOKEN,
  });

  room.setDefaultStadium('Big');
  room.setScoreLimit(5);
  room.setTimeLimit(0);

  room.onRoomLink = (link) => {
    console.log('[core] Room link:', link);
    botStatus.up = true;
    botStatus.roomLink = link;
    botStatus.lastUpdate = new Date().toISOString();
  };

  room.onPlayerJoin = (player) => {
    console.log('[core] Player joined:', player.name);
    botStatus.players = room.getPlayerList().length;
  };

  room.onPlayerLeave = (player) => {
    console.log('[core] Player left:', player.name);
    botStatus.players = room.getPlayerList().length;
  };

  room.onGameStart = () => {
    console.log('[core] Game started');
    botStatus.inProgress = true;
  };

  room.onGameStop = () => {
    console.log('[core] Game stopped');
    botStatus.inProgress = false;
  };

  return { room };
}

async function runWithAutoRestart(db) {
  let restartCount = 0;
  const maxRestarts = 5;
  const restartDelay = 5000;

  while (restartCount < maxRestarts) {
    try {
      console.log('[core] Starting bot instance...');
      const { room } = await startHeadless(db);
      restartCount = 0;
      console.log('[core] Bot running successfully');

      await new Promise(() => {});

    } catch (err) {
      restartCount++;
      console.error(`[core] Error (attempt ${restartCount}/${maxRestarts}):`, err.message);
      
      if (restartCount < maxRestarts) {
        console.log(`[core] Restarting in ${restartDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, restartDelay));
      }
    }
  }

  console.error('[core] Max restart attempts reached. Exiting.');
  process.exit(1);
}

async function main() {
  try {
    require('dotenv').config();
    
    let db = null;
    try {
      const Database = require('./Database');
      db = new Database();
      console.log('[core] Database initialized');
    } catch (err) {
      console.warn('[core] Database not available (optional):', err.message);
    }
    
    startHealthServer();

    await runWithAutoRestart(db);
  } catch (err) {
    console.error('[core] Fatal error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { startHeadless, main };
