const puppeteer = require('puppeteer');
const config = require('../config');
const { buildBotScript } = require('../bot/GameBot');
const fs = require('fs');
const path = require('path');
const express = require('express');

// In-memory status shared with health server
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

	const browser = await puppeteer.launch({
		headless: 'new',
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-gpu',
		],
	});

	const page = await browser.newPage();

  // Daily file logging setup
  try {
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const date = new Date();
    const fname = 'haxchill-' + date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0') + '.log';
    const logPath = path.join(logDir, fname);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    page.on('console', (msg) => {
      const text = msg.text();
      logStream.write(text + '\n');
    });
  } catch (e) {
    console.warn('[core] File logging setup failed:', e.message);
  }

  // Expose stats saver to page if DB is provided
  if (db && typeof db.recordGame === 'function') {
    await page.exposeFunction('saveStats', async (payload) => {
      try {
        db.recordGame(payload);
      } catch (err) {
        console.error('[core] Failed to save stats:', err.message);
      }
    });
    console.log('[core] Stats bridge (saveStats) exposed to page');

    // Expose stats loader
    await page.exposeFunction('loadStats', async (playerAuth) => {
      try {
        return db.getPlayerStats(playerAuth);
      } catch (err) {
        console.error('[core] Failed to load stats:', err.message);
        return null;
      }
    });
    console.log('[core] Stats bridge (loadStats) exposed to page');

    // Alias bridge
    await page.exposeFunction('getAlias', async (playerAuth) => {
      try {
        return db.getAlias(playerAuth);
      } catch (err) {
        console.error('[core] Failed to get alias:', err.message);
        return null;
      }
    });
    await page.exposeFunction('setAlias', async (playerAuth, alias) => {
      try {
        db.setAlias(playerAuth, alias);
      } catch (err) {
        console.error('[core] Failed to set alias:', err.message);
      }
    });
    console.log('[core] Alias bridge (getAlias/setAlias) exposed to page');
  }

  if (db && typeof db.ensurePlayerWithStats === 'function') {
    await page.exposeFunction('registerPlayer', async (playerAuth, name, role) => {
      try {
        db.ensurePlayerWithStats(playerAuth, name, role || 'player');
      } catch (err) {
        console.error('[core] Failed to register player:', err.message);
      }
    });
    console.log('[core] Player registration bridge exposed to page');
  }

  if (db && typeof db.getPlayerByName === 'function') {
    await page.exposeFunction('resolveAuthForName', async (name) => {
      try {
        const rec = db.getPlayerByName(name);
        return rec ? rec.player_auth : null;
      } catch (err) {
        console.error('[core] Failed to resolve auth for name:', err.message);
        return null;
      }
    });
    console.log('[core] Auth resolution bridge (resolveAuthForName) exposed to page');
  }

  // Enhanced console logging with detailed output
  page.on('console', (msg) => {
    try {
      const args = [];
      for (let i = 0; i < msg.args().length; ++i) {
        args.push(msg.args()[i]);
      }
      const location = msg.location();
      const logType = msg.type();
      
      let prefix = '[browser]';
      if (logType === 'error') prefix = '[browser:ERROR]';
      else if (logType === 'warning') prefix = '[browser:WARN]';
      else if (logType === 'log') prefix = '[browser:LOG]';
      
      const fullMsg = prefix + ' ' + msg.text() + (location ? ' @ ' + location.url + ':' + location.lineNumber : '');
      
      // Always output to ensure visibility
      if (logType === 'error') {
        console.error(fullMsg);
      } else if (logType === 'warning') {
        console.warn(fullMsg);
      } else {
        console.log(fullMsg);
      }

      // Update status heuristics from known logs
      if (text.includes('Script initialization complete') || text.includes('HBInit succeeded')) {
        botStatus.up = true;
        botStatus.lastUpdate = new Date().toISOString();
      }
    } catch (e) {
      console.log('[browser]', msg.text());
    }
  });

  // Log page errors
  page.on('error', (err) => {
    console.error('[page:ERROR]', err);
  });

  // Log page request/response for debugging
  page.on('response', (response) => {
    if (response.url().includes('headless')) {
      console.log('[page:RESPONSE]', response.status(), response.url());
    }
  });

  console.log('[core] Navigating to Haxball Headless...');
  await page.goto('https://www.haxball.com/headless', { waitUntil: 'domcontentloaded' });
  console.log('[core] Page loaded, waiting for HBInit...');

  // Wait until HBInit is available on the page (headless host loaded)
  try {
    await page.waitForFunction(() => typeof window.HBInit === 'function', { timeout: 30000 });
    console.log('[core] HBInit found, injecting bot script...');
  } catch (err) {
    console.error('[core] Timeout waiting for HBInit:', err.message);
    await browser.close();
    throw err;
  }

  const botScript = buildBotScript(config, db);

  // Save generated script for debugging
  const fs = require('fs');
  const scriptPath = 'c:/Users/letkh/Documents/GitHub/haxchill/.debug-bot-script.js';
  fs.writeFileSync(scriptPath, botScript, 'utf8');
  console.log('[core] Generated bot script saved to:', scriptPath);
  console.log('[core] Script length:', botScript.length, 'characters');

  // Quick syntax check
  try {
    new Function(botScript);
    console.log('[core] Bot script syntax is valid');
  } catch (syntaxErr) {
    console.error('[core] SYNTAX ERROR in generated bot script:', syntaxErr.message);
    console.error('[core] Check the saved script at:', scriptPath);
    await browser.close();
    throw syntaxErr;
  }

  // Inject and run the bot script in page context
  try {
    await page.addScriptTag({ content: botScript });
    console.log('[core] Bot script injected successfully');
  } catch (err) {
    console.error('[core] Failed to inject bot script:', err);
    await browser.close();
    throw err;
  }

  // Expose status reporting bridge to browser
  await page.exposeFunction('reportStatus', async (payload) => {
    try {
      if (payload && typeof payload === 'object') {
        Object.assign(botStatus, payload);
        botStatus.lastUpdate = new Date().toISOString();
      }
    } catch (err) {
      console.error('[core] Failed to update status:', err.message);
    }
  });
  // Start health server once
  if (!startHeadless.healthStarted) {
    startHealthServer();
    startHeadless.healthStarted = true;
  }

  console.log('[core] Haxball headless host initialized successfully');
  return { browser, page };
}

module.exports = { startHeadless };
