import pool from '../db.js';

// Auto-create table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS rate_limit_store (
    key VARCHAR(512) PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    reset_time TIMESTAMPTZ NOT NULL
  )
`).catch(err => console.error('Rate limit store init error:', err));

// Periodically clean up expired rows (every 10 minutes)
setInterval(() => {
  pool.query('DELETE FROM rate_limit_store WHERE reset_time <= NOW()')
    .catch(() => {});
}, 10 * 60 * 1000);

export class PgRateLimitStore {
  constructor(windowMs) {
    this.windowMs = windowMs;
  }

  async increment(key) {
    try {
      const resetTime = new Date(Date.now() + this.windowMs);
      const result = await pool.query(
        `INSERT INTO rate_limit_store (key, hits, reset_time)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE
         SET
           hits = CASE
             WHEN rate_limit_store.reset_time <= NOW() THEN 1
             ELSE rate_limit_store.hits + 1
           END,
           reset_time = CASE
             WHEN rate_limit_store.reset_time <= NOW() THEN $2
             ELSE rate_limit_store.reset_time
           END
         RETURNING hits, reset_time`,
        [key, resetTime]
      );
      return {
        totalHits: result.rows[0].hits,
        resetTime: result.rows[0].reset_time,
      };
    } catch {
      // Fail open — don't block requests if DB is unavailable
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    try {
      await pool.query(
        `UPDATE rate_limit_store
         SET hits = GREATEST(0, hits - 1)
         WHERE key = $1 AND reset_time > NOW()`,
        [key]
      );
    } catch {}
  }

  async resetKey(key) {
    try {
      await pool.query('DELETE FROM rate_limit_store WHERE key = $1', [key]);
    } catch {}
  }

  async resetAll() {
    try {
      await pool.query('TRUNCATE rate_limit_store');
    } catch {}
  }
}
