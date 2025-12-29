require('dotenv').config();

function safeJson(input, fallback = null) {
	try { return JSON.parse(input); } catch { return fallback; }
}

const config = {
	HEADLESS_TOKEN: process.env.HAXBALL_TOKEN || process.env.HEADLESS_TOKEN || null,
	ROOM: {
		name: process.env.ROOM_NAME || 'HaxChill Room',
		maxPlayers: parseInt(process.env.ROOM_MAX || '12', 10),
		public: process.env.ROOM_PUBLIC ? process.env.ROOM_PUBLIC === 'true' : true,
		password: process.env.ROOM_PASSWORD || null,
		geo: process.env.ROOM_GEO ? safeJson(process.env.ROOM_GEO, null) : null,
	},
};

module.exports = config;

