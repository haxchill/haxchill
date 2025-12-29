const helpCmd = require('./commands/help');
const rrCmd = require('./commands/rr');
const startCmd = require('./commands/start');
const addadminCmd = require('./commands/addadmin');
const afkCmd = require('./commands/afk');
const statsCmd = require('./commands/stats');
const statusCmd = require('./commands/status');
const deanonCmd = require('./commands/deanon');

const onRoomLink = require('./events/onRoomLink');
const onPlayerJoin = require('./events/onPlayerJoin');
const onPlayerLeave = require('./events/onPlayerLeave');
const onPlayerChat = require('./events/onPlayerChat');
const onTeamGoal = require('./events/onTeamGoal');
const onGameStop = require('./events/onGameStop');
const onGameStart = require('./events/onGameStart');
const onPlayerBallKick = require('./events/onPlayerBallKick');
const onPositionsReset = require('./events/onPositionsReset');

const GameState = require('./lib/GameState');
const CaptainDraft = require('./lib/CaptainDraft');
const Logger = require('./lib/Logger');
const AutoManagerSrcPath = path.join(__dirname, 'lib/AutoManager.js');
const fs = require('fs');
const path = require('path');

function buildBotScript(config, db) {
  const { ROOM, HEADLESS_TOKEN } = config;

  const options = {
    roomName: ROOM?.name || 'HaxChill Room',
    maxPlayers: Number(ROOM?.maxPlayers ?? 8),
    public: ROOM?.public !== false,
    password: ROOM?.password || null,
    geo: ROOM?.geo || null,
    token: HEADLESS_TOKEN,
    noPlayer: true,
  };
  
  const admins = db ? db.getPrivilegedPlayers().map(p => ({ auth: p.player_auth, name: p.name, role: p.role })) : [];
  const adminsJson = JSON.stringify(admins);

  const commands = [helpCmd, rrCmd, startCmd, addadminCmd, afkCmd, statsCmd, deanonCmd, statusCmd]
    .map((c) => `({name:${JSON.stringify(c.name)},trigger:${JSON.stringify(c.trigger)},description:${JSON.stringify(c.description)},handle:${c.handle.toString()}})`)
    .join(',');

  const events = `({
    onRoomLink: ${onRoomLink.toString()},
    onPlayerJoin: ${onPlayerJoin.toString()},
    onPlayerLeave: ${onPlayerLeave.toString()},
    onPlayerChat: ${onPlayerChat.toString()},
    onTeamGoal: ${onTeamGoal.toString()},
    onGameStop: ${onGameStop.toString()},
    onGameStart: ${onGameStart.toString()},
    onPlayerBallKick: ${onPlayerBallKick.toString()},
    onPositionsReset: ${onPositionsReset.toString()}
  })`;

  const gameStateCode = fs.readFileSync(path.join(__dirname, 'lib/GameState.js'), 'utf8')
    .replace(/module\.exports\s*=\s*.+;?\s*$/, ''); // Remove module.exports line
  const captainDraftCode = fs.readFileSync(path.join(__dirname, 'lib/CaptainDraft.js'), 'utf8')
    .replace(/module\.exports\s*=\s*.+;?\s*$/, '');
  const loggerCode = fs.readFileSync(path.join(__dirname, 'lib/Logger.js'), 'utf8')
    .replace(/module\.exports\s*=\s*.+;?\s*$/, '');
  const autoManagerCode = fs.readFileSync(AutoManagerSrcPath, 'utf8')
    .replace(/module\.exports\s*=\s*.+;?\s*$/, '');

  return `(function() {
  console.log('[script] IIFE starting execution');
  
  try {
    console.log('[script] Attempting to call HBInit...');
    const room = HBInit(${JSON.stringify(options)});
    console.log('[script] HBInit succeeded, room created');
    
    console.log('[injected] Bot script starting...');
    console.log('[injected] HBInit room object created');
    
    console.log('[injected] Initializing Logger...');
    ${loggerCode}
    console.log('[injected] Logger initialized');
    
    console.log('[injected] Initializing GameState...');
    ${gameStateCode}
    console.log('[injected] GameState initialized');
    
    console.log('[injected] Initializing CaptainDraft...');
    ${captainDraftCode}
    console.log('[injected] CaptainDraft initialized');

    console.log('[injected] Initializing AutoManager...');
    ${autoManagerCode}
    console.log('[injected] AutoManager initialized');
    
    const ADMIN_LIST = ${adminsJson};
    console.log('[injected] Loaded ' + ADMIN_LIST.length + ' admins from database');
    
    const ctx = { room, gameState: GameState, captainDraft: CaptainDraft, logger: Logger, adminList: ADMIN_LIST, afkTimers: {}, touches: { lastTouches: [null, null], lastTeamTouched: 0 }, auto: AutoManager };

    const COMMANDS = [${commands}];
    const EVENTS = ${events};

    Logger.info('Configuring room settings...');
    room.setDefaultStadium('Big');
    room.setScoreLimit(1);
    room.setTimeLimit(0);
    
    room.setTeamsLock(true);
    Logger.info('Room configured');
    if (typeof reportStatus === 'function') {
      try { reportStatus({ up: true }); } catch (e) {}
    }

    room.onRoomLink = (url) => {
      try {
        Logger.info('onRoomLink event fired with URL: ' + url);
        EVENTS.onRoomLink(ctx, url);
        if (typeof reportStatus === 'function') { try { reportStatus({ roomLink: url }); } catch (e) {} }
      } catch (e) {
        console.error('[onRoomLink error]', e.message, e.stack);
      }
    };
    
    room.onPlayerJoin = (player) => {
      try {
        Logger.info('onPlayerJoin event fired for player: ' + player.name);
        EVENTS.onPlayerJoin(ctx, player);
        const s = ctx.gameState.getState();
        if (typeof reportStatus === 'function') { try { reportStatus({ players: Object.keys(s.players).length, size: s.gameSize }); } catch (e) {} }
      } catch (e) {
        console.error('[onPlayerJoin error]', e.message);
      }
    };
    
    room.onPlayerLeave = (player) => {
      try {
        Logger.info('onPlayerLeave event fired for player: ' + player.name);
        EVENTS.onPlayerLeave(ctx, player);
        const s = ctx.gameState.getState();
        if (typeof reportStatus === 'function') { try { reportStatus({ players: Object.keys(s.players).length, size: s.gameSize }); } catch (e) {} }
      } catch (e) {
        console.error('[onPlayerLeave error]', e.message);
      }
    };
    
    room.onPlayerChat = (player, message) => {
      try {
        Logger.debug('onPlayerChat: ' + player.name + ' said: ' + message);
        return EVENTS.onPlayerChat(ctx, player, message, COMMANDS);
      } catch (e) {
        console.error('[onPlayerChat error]', e.message);
        return true;
      }
    };
    
    room.onTeamGoal = (team) => {
      try {
        Logger.info('onTeamGoal event fired for team: ' + team);
        EVENTS.onTeamGoal(ctx, team);
      } catch (e) {
        console.error('[onTeamGoal error]', e.message);
      }
    };
    room.onPlayerBallKick = (player) => {
      try {
        Logger.debug('onPlayerBallKick by: ' + player.name);
        EVENTS.onPlayerBallKick(ctx, player);
      } catch (e) {
        console.error('[onPlayerBallKick error]', e.message);
      }
    };
    room.onPositionsReset = () => {
      try {
        Logger.debug('onPositionsReset');
        EVENTS.onPositionsReset(ctx);
      } catch (e) {
        console.error('[onPositionsReset error]', e.message);
      }
    };
    
    room.onGameStop = (byPlayer) => {
      try {
        Logger.info('onGameStop event fired');
        EVENTS.onGameStop(ctx);
        if (typeof reportStatus === 'function') { try { reportStatus({ inProgress: false }); } catch (e) {} }
      } catch (e) {
        console.error('[onGameStop error]', e.message);
      }
    };
    
    room.onGameStart = (byPlayer) => {
      try {
        Logger.info('onGameStart event fired');
        EVENTS.onGameStart(ctx);
        if (typeof reportStatus === 'function') { try { reportStatus({ inProgress: true, draft: !!(ctx.captainDraft && ctx.captainDraft.isDraftActive && ctx.captainDraft.isDraftActive()) }); } catch (e) {} }
      } catch (e) {
        console.error('[onGameStart error]', e.message);
      }
    };
    
    Logger.info('All event handlers registered');
    console.log('[injected] Script initialization complete');
  } catch (e) {
    console.error('[script] FATAL ERROR:', e.message);
    console.error('[script] Stack:', e.stack);
  }
})();`;
}

module.exports = { buildBotScript };




