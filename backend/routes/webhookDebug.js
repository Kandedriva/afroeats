import express from "express";
import pool from "../db.js";

const router = express.Router();

// Webhook diagnostic endpoint
router.get("/webhook-status", async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? '✅ Configured' : '❌ Missing',
      checks: {}
    };

    // Check recent temp_order_data
    const tempDataResult = await pool.query(`
      SELECT
        session_id,
        created_at,
        (order_data->>'userId')::int as user_id,
        (order_data->>'total')::numeric as total
      FROM temp_order_data
      ORDER BY created_at DESC
      LIMIT 5
    `);

    diagnostics.checks.recentTempOrders = {
      count: tempDataResult.rows.length,
      data: tempDataResult.rows
    };

    // Check if orders exist for these sessions
    if (tempDataResult.rows.length > 0) {
      const sessionIds = tempDataResult.rows.map(row => row.session_id);
      const ordersResult = await pool.query(`
        SELECT
          id,
          stripe_session_id,
          user_id,
          total,
          status,
          created_at
        FROM orders
        WHERE stripe_session_id = ANY($1)
        ORDER BY created_at DESC
      `, [sessionIds]);

      diagnostics.checks.ordersCreated = {
        count: ordersResult.rows.length,
        data: ordersResult.rows,
        missing: sessionIds.length - ordersResult.rows.length
      };

      // Find which sessions don't have orders
      const createdSessionIds = new Set(ordersResult.rows.map(o => o.stripe_session_id));
      const missingOrders = tempDataResult.rows.filter(
        temp => !createdSessionIds.has(temp.session_id)
      );

      diagnostics.checks.missingOrders = {
        count: missingOrders.length,
        sessions: missingOrders.map(temp => ({
          sessionId: temp.session_id,
          created: temp.created_at,
          userId: temp.user_id,
          total: temp.total
        }))
      };
    }

    // Check recent orders (last 10)
    const recentOrders = await pool.query(`
      SELECT
        o.id,
        o.user_id,
        o.total,
        o.status,
        o.stripe_session_id,
        o.created_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    diagnostics.checks.recentOrders = {
      count: recentOrders.rows.length,
      data: recentOrders.rows
    };

    // Summary
    diagnostics.summary = {
      webhookConfigured: diagnostics.webhookSecret === '✅ Configured',
      tempOrdersWaiting: diagnostics.checks.missingOrders?.count || 0,
      recentOrdersCreated: recentOrders.rows.length,
      possibleIssue: (diagnostics.checks.missingOrders?.count || 0) > 0
        ? '⚠️ Webhook may not be processing temp orders'
        : '✅ All temp orders processed'
    };

    res.json(diagnostics);
  } catch (error) {
    console.error('❌ Webhook diagnostic error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Check specific order by session ID
router.get("/check-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check temp data
    const tempData = await pool.query(
      'SELECT * FROM temp_order_data WHERE session_id = $1',
      [sessionId]
    );

    // Check if order exists
    const order = await pool.query(
      'SELECT * FROM orders WHERE stripe_session_id = $1',
      [sessionId]
    );

    // Get order items if order exists
    let orderItems = { rows: [] };
    if (order.rows.length > 0) {
      orderItems = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.rows[0].id]
      );
    }

    res.json({
      sessionId,
      tempDataExists: tempData.rows.length > 0,
      orderExists: order.rows.length > 0,
      tempData: tempData.rows[0] || null,
      order: order.rows[0] || null,
      orderItems: orderItems.rows,
      status: order.rows.length > 0
        ? '✅ Order created successfully'
        : tempData.rows.length > 0
          ? '⚠️ Temp data exists but order not created (webhook not called)'
          : '❌ No data found for this session'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
