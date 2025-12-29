const Database = require('better-sqlite3');
const path = require('path');

class HaxballDatabase {
  constructor(dbPath = path.join(__dirname, '../../haxchill.db')) {
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    // Create players table with auth and role (player, vip, admin, host)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_auth TEXT UNIQUE NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'player',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_player_auth ON players(player_auth);
      
      CREATE TABLE IF NOT EXISTS player_stats (
        player_auth TEXT PRIMARY KEY,
        last_name TEXT,
        games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_auth) REFERENCES players(player_auth)
      );

      CREATE TABLE IF NOT EXISTS player_aliases (
        player_auth TEXT PRIMARY KEY,
        alias TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_auth) REFERENCES players(player_auth)
      );
    `);
    
    console.log('Database initialized');
  }

  // Get player by auth
  getPlayerByAuth(playerAuth) {
    const stmt = this.db.prepare('SELECT * FROM players WHERE player_auth = ?');
    return stmt.get(playerAuth);
  }

  // Get best-matching player by name (case-insensitive), prioritizing privileged roles
  getPlayerByName(name) {
    const stmt = this.db.prepare(`
      SELECT * FROM players
      WHERE LOWER(name) = LOWER(?)
      ORDER BY
        CASE role
          WHEN 'host' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'vip' THEN 3
          ELSE 4
        END,
        updated_at DESC
      LIMIT 1;
    `);
    return stmt.get(name);
  }

  // Add or update player
  upsertPlayer(playerAuth, name, role = 'player') {
    const stmt = this.db.prepare(`
      INSERT INTO players (player_auth, name, role, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(playerAuth, name, role);
  }

  // Ensure player exists and has a stats row with zeroed counters
  ensurePlayerWithStats(playerAuth, name, role = 'player') {
    const upsertPlayerStmt = this.db.prepare(`
      INSERT INTO players (player_auth, name, role, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertStatsStmt = this.db.prepare(`
      INSERT INTO player_stats (player_auth, last_name, games, wins, draws, losses, last_seen, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        last_name = excluded.last_name,
        updated_at = CURRENT_TIMESTAMP
    `);

    const txn = this.db.transaction((auth, playerName, playerRole) => {
      upsertPlayerStmt.run(auth, playerName, playerRole);
      upsertStatsStmt.run(auth, playerName);
    });

    return txn(playerAuth, name, role);
  }

  // Set player role (player, vip, admin, host)
  setPlayerRole(playerAuth, role) {
    const stmt = this.db.prepare(`
      UPDATE players SET role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE player_auth = ?
    `);
    return stmt.run(role, playerAuth);
  }

  // Generic fetchers
  getByRole(role) {
    const stmt = this.db.prepare('SELECT * FROM players WHERE role = ?');
    return stmt.all(role);
  }

  getByRoles(roles = []) {
    if (!roles.length) return [];
    const placeholders = roles.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM players WHERE role IN (${placeholders})`);
    return stmt.all(...roles);
  }

  // Convenience getters
  getAdmins() {
    return this.getByRole('admin');
  }

  getHosts() {
    return this.getByRole('host');
  }

  getPrivilegedPlayers() {
    return this.getByRoles(['admin', 'host']);
  }

  // Aliases (deanon)
  getAlias(playerAuth) {
    const stmt = this.db.prepare('SELECT alias FROM player_aliases WHERE player_auth = ?');
    return stmt.get(playerAuth);
  }

  setAlias(playerAuth, alias) {
    const stmt = this.db.prepare(`
      INSERT INTO player_aliases (player_auth, alias, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        alias = excluded.alias,
        updated_at = CURRENT_TIMESTAMP;
    `);
    return stmt.run(playerAuth, alias);
  }

  // Stats helpers
  getPlayerStats(playerAuth) {
    const stmt = this.db.prepare('SELECT * FROM player_stats WHERE player_auth = ?');
    return stmt.get(playerAuth);
  }

  recordGame(payload) {
    if (!payload || !Array.isArray(payload.players)) return;
    const winnerTeam = payload.winnerTeam; // 1, 2, or null for draw

    const insertStats = this.db.prepare(`
      INSERT INTO player_stats (player_auth, last_name, games, wins, draws, losses, last_seen, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        last_name = excluded.last_name,
        games = player_stats.games + 1,
        wins = player_stats.wins + excluded.wins,
        draws = player_stats.draws + excluded.draws,
        losses = player_stats.losses + excluded.losses,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
    `);

    const insertPlayer = this.db.prepare(`
      INSERT INTO players (player_auth, name, role, updated_at)
      VALUES (?, ?, 'player', CURRENT_TIMESTAMP)
      ON CONFLICT(player_auth) DO UPDATE SET
        name = excluded.name,
        updated_at = CURRENT_TIMESTAMP;
    `);

    const txn = this.db.transaction((rows) => {
      rows.forEach((p) => {
        // ignore spectators
        if (p.team !== 1 && p.team !== 2) return;
        const isWin = winnerTeam && p.team === winnerTeam;
        const isDraw = !winnerTeam;
        const win = isWin ? 1 : 0;
        const draw = isDraw ? 1 : 0;
        const loss = !isWin && !isDraw ? 1 : 0;

        insertPlayer.run(p.auth || 'guest-' + p.id, p.name || 'Unknown');
        insertStats.run(p.auth || 'guest-' + p.id, p.name || 'Unknown', win, draw, loss);
      });
    });

    txn(payload.players);
  }

  // Check if player is admin
  isAdmin(playerAuth) {
    const player = this.getPlayerByAuth(playerAuth);
    return player && (player.role === 'admin' || player.role === 'host');
  }

  close() {
    this.db.close();
  }
}

module.exports = HaxballDatabase;
