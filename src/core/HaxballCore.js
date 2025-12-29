const config = require('../config');
const express = require('express');
const HeadlessConnector = require('./HeadlessConnector');

const botStatus = {
  up: false,
  roomLink: null,
  players: 0,
  size: null,
  draft: false,
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
    throw new Error('HEADLESS_TOKEN is missing. Set HAXBALL_TOKEN or HEADLESS_TOKEN in environment or .env');
  }

  const connector = new HeadlessConnector(config.HEADLESS_TOKEN, {
    roomName: config.ROOM?.name || 'HaxChill Room',
    maxPlayers: Number(config.ROOM?.maxPlayers ?? 8),
    public: config.ROOM?.public !== false,
    password: config.ROOM?.password || null,
  });

  console.log('[core] Connecting to Haxball Headless...');
  await connector.connect();

  console.log('[core] Room initialized. Link:', connector.roomLink);
  botStatus.up = true;
  botStatus.roomLink = connector.roomLink;

  connector.setDefaultStadium('Big');
  connector.setScoreLimit(5);
  connector.setTimeLimit(0);

  connector.callbacks.onRoomLink = (link) => {
    console.log('[core] Room link:', link);
    botStatus.roomLink = link;
  };

  connector.callbacks.onPlayerJoin = (player) => {
    console.log('[core] Player joined:', player.name);
    botStatus.players = connector.getPlayerList().length;
  };

  connector.callbacks.onPlayerLeave = (player) => {
    console.log('[core] Player left:', player.name);
    botStatus.players = connector.getPlayerList().length;
  };

  connector.callbacks.onGameStart = (byPlayer) => {
    console.log('[core] Game started');
    botStatus.inProgress = true;
  };

  connector.callbacks.onGameStop = () => {
    console.log('[core] Game stopped');
    botStatus.inProgress = false;
  };

  return { connector };
}

async function runWithAutoRestart(db) {
  let restartCount = 0;
  const maxRestarts = 5;
  const restartDelay = 5000;

  while (restartCount < maxRestarts) {
    try {
      console.log('[core] Starting bot instance...');
      const { connector } = await startHeadless(db);
      restartCount = 0;
      console.log('[core] Bot running successfully');

      await new Promise(resolve => {
        setTimeout(resolve, 3600000);
      });

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
