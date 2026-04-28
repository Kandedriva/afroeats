import Stripe from 'stripe';
import pool from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a grocery owner notification for an order if one does not already exist.
 * Safe to call from multiple places (webhook + verify-session) — skips if already created.
 *
 * Owner lookup uses 3-level fallback:
 *   1. ownerId from Stripe session metadata (set at order-creation time)
 *   2. Walk order_items → products → grocery_stores → grocery_store_owners
 *   3. Single-owner fallback — takes the one grocery owner in the system
 */
export async function ensureGroceryNotification(orderId, stripeSessionId = null) {
  try {
    // Skip if notification already exists (webhook may have already run)
    const existing = await pool.query(
      `SELECT id FROM grocery_owner_notifications
       WHERE grocery_order_id = $1 AND type = 'new_order'`,
      [orderId]
    );
    if (existing.rows.length > 0) {
      console.log(`[Notif] Notification already exists for order ${orderId}, skipping`);
      return;
    }

    // ── Level 1: ownerId baked into Stripe session metadata at order creation ──
    let ownerId = null;
    if (stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
        const raw = session.metadata?.ownerId;
        if (raw) ownerId = parseInt(raw);
        if (ownerId) console.log(`[Notif] ownerId from metadata: ${ownerId}`);
      } catch (_) { /* ignore — session may not be retrievable */ }
    }

    // ── Level 2: order_items → products → grocery_stores → owners ──
    if (!ownerId) {
      const r = await pool.query(
        `SELECT gso.id
         FROM grocery_store_owners gso
         JOIN grocery_stores gs ON gs.owner_id = gso.id
         JOIN products p ON p.store_id = gs.id
         JOIN grocery_order_items goi ON goi.product_id = p.id
         WHERE goi.grocery_order_id = $1
         LIMIT 1`,
        [orderId]
      );
      ownerId = r.rows[0]?.id || null;
      if (ownerId) console.log(`[Notif] ownerId from products chain: ${ownerId}`);
    }

    // ── Level 3: single-owner system — take whoever the one owner is ──
    if (!ownerId) {
      const r = await pool.query(
        `SELECT gso.id
         FROM grocery_store_owners gso
         JOIN grocery_stores gs ON gs.owner_id = gso.id
         LIMIT 1`
      );
      ownerId = r.rows[0]?.id || null;
      if (ownerId) console.log(`[Notif] ownerId from last-resort fallback: ${ownerId}`);
    }

    if (!ownerId) {
      console.error(`[Notif] No owner found for order ${orderId} — notification not created`);
      return;
    }

    // Fetch order details for the notification message
    const orderRow = await pool.query(
      `SELECT go.total, go.delivery_name, u.name AS user_name
       FROM grocery_orders go
       LEFT JOIN users u ON go.user_id = u.id
       WHERE go.id = $1`,
      [orderId]
    );
    const order = orderRow.rows[0];
    const customerName = order?.user_name || order?.delivery_name || 'Customer';
    const total = parseFloat(order?.total || 0);

    // Ensure table exists (safe to run every time)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grocery_owner_notifications (
        id SERIAL PRIMARY KEY,
        grocery_owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
        grocery_order_id INTEGER REFERENCES grocery_orders(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(
      `INSERT INTO grocery_owner_notifications
         (grocery_owner_id, grocery_order_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ownerId,
        orderId,
        'new_order',
        `New Order #${orderId}`,
        `You have a new grocery order from ${customerName} for $${total.toFixed(2)}`,
        JSON.stringify({ orderId, customerName, total: total.toFixed(2) })
      ]
    );

    console.log(`✅ [Notif] Created for owner ${ownerId}, order ${orderId}`);
  } catch (err) {
    console.error(`[Notif] Error for order ${orderId}:`, err.message);
    console.error(err.stack);
  }
}
