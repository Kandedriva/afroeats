import pool from '../db.js';

// Auto-create table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS cache_store (
    key VARCHAR(512) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  )
`).catch(err => console.error('Cache store init error:', err));

// Periodically clean up expired rows (every 10 minutes)
setInterval(() => {
  pool.query('DELETE FROM cache_store WHERE expires_at <= NOW()')
    .catch(() => {});
}, 10 * 60 * 1000);

const DEFAULT_TTL = 3600; // 1 hour

export const cache = {
  async get(key) {
    try {
      const result = await pool.query(
        'SELECT value FROM cache_store WHERE key = $1 AND expires_at > NOW()',
        [key]
      );
      if (result.rows.length === 0) return null;
      try { return JSON.parse(result.rows[0].value); } catch { return result.rows[0].value; }
    } catch {
      return null;
    }
  },

  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await pool.query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE
         SET value = $2, expires_at = $3`,
        [key, JSON.stringify(value), expiresAt]
      );
      return true;
    } catch {
      return false;
    }
  },

  async del(key) {
    try {
      await pool.query('DELETE FROM cache_store WHERE key = $1', [key]);
      return true;
    } catch {
      return false;
    }
  },

  async incr(key, ttl = 86400) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const result = await pool.query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, '1', $2)
         ON CONFLICT (key) DO UPDATE
         SET
           value = CASE
             WHEN cache_store.expires_at <= NOW() THEN '1'
             ELSE (CAST(cache_store.value AS INTEGER) + 1)::TEXT
           END,
           expires_at = CASE
             WHEN cache_store.expires_at <= NOW() THEN $2
             ELSE cache_store.expires_at
           END
         RETURNING value`,
        [key, expiresAt]
      );
      return parseInt(result.rows[0].value);
    } catch {
      return 1;
    }
  },

  async expire(key, ttl) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await pool.query(
        'UPDATE cache_store SET expires_at = $1 WHERE key = $2',
        [expiresAt, key]
      );
      return true;
    } catch {
      return false;
    }
  },

  async ttl(key) {
    try {
      const result = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (expires_at - NOW()))::INTEGER AS ttl
         FROM cache_store WHERE key = $1`,
        [key]
      );
      if (result.rows.length === 0) return -1;
      return Math.max(0, result.rows[0].ttl);
    } catch {
      return -1;
    }
  },

  async clearPattern(pattern) {
    try {
      const sqlPattern = pattern.replace(/\*/g, '%');
      await pool.query('DELETE FROM cache_store WHERE key LIKE $1', [sqlPattern]);
      return true;
    } catch {
      return false;
    }
  },

  async keys(pattern) {
    try {
      const sqlPattern = pattern.replace(/\*/g, '%');
      const result = await pool.query(
        'SELECT key FROM cache_store WHERE key LIKE $1 AND expires_at > NOW()',
        [sqlPattern]
      );
      return result.rows.map(r => r.key);
    } catch {
      return [];
    }
  },

  // Set operations (kept for compatibility)
  async sadd(key, member, ttl = 86400) {
    try {
      const existing = await this.get(key);
      const set = new Set(Array.isArray(existing) ? existing : []);
      const sizeBefore = set.size;
      set.add(member);
      await this.set(key, Array.from(set), ttl);
      return set.size - sizeBefore;
    } catch {
      return 0;
    }
  },

  async scard(key) {
    try {
      const existing = await this.get(key);
      return Array.isArray(existing) ? existing.length : 0;
    } catch {
      return 0;
    }
  },
};

console.log('✅ Using PostgreSQL-backed cache (rate limits and lockouts survive restarts)');
