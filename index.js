const { startHeadless } = require('./src/core/HaxballCore');
const HaxballDatabase = require('./src/db/Database');

async function runWithAutoRestart(db) {
	let instance = null;
	const restart = async (reason) => {
		try {
			console.warn('[core] Restarting headless due to:', reason || 'unknown');
			if (instance && instance.browser) {
				try { await instance.browser.close(); } catch {}
			}
			instance = await startHeadless(db);
			attachMonitors(instance);
			console.log('[core] Headless restarted');
		} catch (err) {
			console.error('[core] Restart failed:', err.message);
			setTimeout(() => restart('retry'), 5000);
		}
	};

	const attachMonitors = ({ browser, page }) => {
		if (!browser || !page) return;
		browser.on('disconnected', () => restart('browser disconnected'));
		page.on('error', (err) => restart('page error: ' + err.message));
		page.on('close', () => restart('page closed'));
	};

	instance = await startHeadless(db);
	attachMonitors(instance);
	console.log('Server started. Press Ctrl+C to stop.');
}

(async () => {
	try {
		// Initialize database
		const db = new HaxballDatabase();
		console.log('Database initialized');
		await runWithAutoRestart(db);
	} catch (err) {
		console.error('Failed to start:', err);
		process.exit(1);
	}
})();

