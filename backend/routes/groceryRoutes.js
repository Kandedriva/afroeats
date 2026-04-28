import express from 'express';
import Stripe from 'stripe';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { calculateDistanceAndFee, getFallbackDeliveryFee } from '../services/googleMapsService.js';
import { sendOrderDeliveredEmail, sendGroceryRefundRequestEmail } from '../services/emailService.js';
import { ensureGroceryNotification } from '../services/groceryNotificationService.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Calculate delivery fee for grocery order
 * POST /api/grocery/calculate-delivery
 */
router.post('/calculate-delivery', async (req, res) => {
  try {
    const { deliveryAddress } = req.body;

    if (!deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    // For grocery orders, we'll use a fixed warehouse location
    // In production, this would be the actual warehouse/distribution center address
    const warehouseAddress = '581 Timpson Pl, Bronx, NY 10455, United States';

    try {
      // Calculate distance and delivery fee using Google Maps
      const feeData = await calculateDistanceAndFee(warehouseAddress, deliveryAddress);

      res.json({
        delivery_fee: feeData.total_delivery_fee,
        distance_miles: feeData.distance_miles,
        distance_text: feeData.distance_text,
        duration_text: feeData.duration_text,
        driver_payout: feeData.driver_payout,
        platform_commission: feeData.platform_commission,
        estimated: false
      });
    } catch (error) {
      console.error('Google Maps calculation failed, using fallback:', error);

      // Use fallback delivery fee if Google Maps fails
      const fallbackFee = getFallbackDeliveryFee();
      res.json(fallbackFee);
    }
  } catch (err) {
    console.error('Calculate delivery error:', err);
    res.status(500).json({ error: 'Failed to calculate delivery fee' });
  }
});

/**
 * Create grocery order and Stripe checkout session
 * POST /api/grocery/create-order
 * Supports both authenticated users and guest checkout
 */
router.post('/create-order', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      items,
      deliveryAddress,
      notes,
      subtotal,
      platformFee,
      deliveryFee,
      total,
      deliveryInfo,
      guestEmail // For guest checkout
    } = req.body;

    const userId = req.session?.userId || null;
    const isGuest = !userId;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!deliveryAddress || !deliveryAddress.address || !deliveryAddress.city) {
      return res.status(400).json({ error: 'Complete delivery address is required' });
    }

    if (!deliveryAddress.email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // For guest orders, require guest email
    if (isGuest && !guestEmail) {
      return res.status(400).json({ error: 'Email is required for guest checkout' });
    }

    await client.query('BEGIN');

    // Create grocery order (supports both authenticated and guest users)
    const orderResult = await client.query(
      `INSERT INTO grocery_orders (
        user_id, guest_email, subtotal, platform_fee, delivery_fee, total,
        delivery_address, delivery_city, delivery_state, delivery_zip,
        delivery_phone, delivery_name, notes,
        distance_miles, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', NOW())
      RETURNING id`,
      [
        userId,
        isGuest ? guestEmail : null,
        subtotal,
        platformFee,
        deliveryFee,
        total,
        deliveryAddress.address,
        deliveryAddress.city,
        deliveryAddress.state || '',
        deliveryAddress.zipCode || '',
        deliveryAddress.phone,
        deliveryAddress.name,
        notes || null,
        deliveryInfo?.distance_miles || 0
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO grocery_order_items (
          grocery_order_id, product_id, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.id, item.quantity, item.price, item.price * item.quantity]
      );
    }

    // Resolve store and owner for notification routing
    // Priority 1: store_id already on the cart items (set when products were created by owner)
    // Priority 2: DB lookup by product IDs
    // Priority 3: single-owner fallback
    let storeId = null;
    let ownerId = null;
    try {
      // Cart items carry store_id when products have it set
      const storeIdFromItems = items.find(i => i.store_id != null)?.store_id;
      if (storeIdFromItems) {
        storeId = storeIdFromItems;
        console.log(`[Order ${orderId}] storeId from cart items: ${storeId}`);
      } else {
        // Fallback: query DB
        const productIds = items.map(i => i.id);
        const storeResult = await client.query(
          `SELECT DISTINCT p.store_id
           FROM products p
           WHERE p.id = ANY($1) AND p.store_id IS NOT NULL
           LIMIT 1`,
          [productIds]
        );
        if (storeResult.rows.length > 0) {
          storeId = storeResult.rows[0].store_id;
          console.log(`[Order ${orderId}] storeId from DB lookup: ${storeId}`);
        } else {
          console.warn(`[Order ${orderId}] No store_id found — products may have NULL store_id`);
        }
      }

      if (storeId) {
        const ownerLookup = await client.query(
          `SELECT gso.id FROM grocery_store_owners gso
           JOIN grocery_stores gs ON gs.owner_id = gso.id
           WHERE gs.id = $1`,
          [storeId]
        );
        if (ownerLookup.rows.length > 0) {
          ownerId = ownerLookup.rows[0].id;
          console.log(`[Order ${orderId}] ownerId resolved: ${ownerId}`);
        } else {
          console.warn(`[Order ${orderId}] No owner found for store ${storeId}`);
        }
      }

      // Last resort: if still no ownerId, use the only/first grocery owner
      if (!ownerId) {
        const fallback = await client.query(
          `SELECT gso.id FROM grocery_store_owners gso
           JOIN grocery_stores gs ON gs.owner_id = gso.id
           LIMIT 1`
        );
        if (fallback.rows.length > 0) {
          ownerId = fallback.rows[0].id;
          console.warn(`[Order ${orderId}] Using fallback ownerId: ${ownerId}`);
        }
      }
    } catch (lookupErr) {
      console.error(`[Order ${orderId}] Could not resolve storeId/ownerId:`, lookupErr.message);
    }

    // Create Stripe checkout session
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `${item.quantity} ${item.unit}`,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add platform fee as line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Platform Fee',
          description: 'Service fee',
        },
        unit_amount: Math.round(platformFee * 100),
      },
      quantity: 1,
    });

    // Add delivery fee as line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Delivery Fee',
          description: deliveryInfo?.distance_miles
            ? `${deliveryInfo.distance_miles} miles`
            : 'Standard delivery',
        },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });

    const customerEmail = isGuest ? guestEmail : (req.session?.userEmail || deliveryAddress.email);
    const successUrl = isGuest
      ? `${FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}&type=grocery&guest=true`
      : `${FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}&type=grocery`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `${FRONTEND_URL}/grocery-checkout?cancelled=true`,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId.toString(),
        userId: userId ? userId.toString() : 'guest',
        orderType: 'grocery',
        isGuest: isGuest.toString(),
        guestEmail: isGuest ? guestEmail : '',
        storeId: storeId ? storeId.toString() : '',
        ownerId: ownerId ? ownerId.toString() : '',
      },
    });

    // Store Stripe session info
    await client.query(
      `UPDATE grocery_orders
       SET stripe_session_id = $1, stripe_payment_intent = $2
       WHERE id = $3`,
      [session.id, session.payment_intent, orderId]
    );

    await client.query('COMMIT');

    res.json({
      sessionUrl: session.url,
      orderId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create grocery order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

/**
 * Verify Stripe session and get order ID
 * GET /api/grocery/verify-session?session_id=xxx
 * Public endpoint - works for both authenticated and guest users
 */
router.get('/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Get order by Stripe session ID
    const result = await pool.query(
      'SELECT id FROM grocery_orders WHERE stripe_session_id = $1',
      [session_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderId = result.rows[0].id;

    // Respond immediately, then create notification in background.
    // This is the fallback for dev (no Stripe CLI) and production webhook delays.
    // Safe to call even if the webhook already ran — skips if notification exists.
    res.json({ orderId });

    setImmediate(() => ensureGroceryNotification(orderId, session_id));
  } catch (err) {
    console.error('Verify session error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

/**
 * Get single grocery order by ID
 * GET /api/grocery/orders/:id
 * Supports both authenticated and guest users
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.session?.userId;
    const isGuest = !userId;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Get order with items
    // For authenticated users, verify user_id matches
    // For guest users, just return the order (they have the order ID from Stripe redirect)
    const whereClause = isGuest
      ? 'WHERE go.id = $1'
      : 'WHERE go.id = $1 AND go.user_id = $2';
    const params = isGuest ? [orderId] : [orderId, userId];

    const result = await pool.query(
      `SELECT
        go.id, go.subtotal, go.platform_fee, go.delivery_fee, go.total,
        go.status, go.created_at, go.paid_at, go.delivered_at,
        go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
        go.delivery_name, go.delivery_phone, go.notes, go.guest_email,
        json_agg(
          json_build_object(
            'product_id', goi.product_id,
            'product_name', p.name,
            'quantity', goi.quantity,
            'unit', p.unit,
            'unit_price', goi.unit_price,
            'total_price', goi.total_price,
            'image_url', p.image_url
          ) ORDER BY goi.id
        ) as items
      FROM grocery_orders go
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      LEFT JOIN products p ON goi.product_id = p.id
      ${whereClause}
      GROUP BY go.id`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get grocery order error:', err);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

/**
 * Track guest grocery order by email and order ID
 * POST /api/grocery/guest-track
 * Public endpoint for guests to track their orders
 */
router.post('/guest-track', async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ error: 'Order ID and email are required' });
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Get order with items - verify email matches guest_email
    const result = await pool.query(
      `SELECT
        go.id, go.subtotal, go.platform_fee, go.delivery_fee, go.total,
        go.status, go.created_at, go.paid_at, go.delivered_at,
        go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
        go.delivery_name, go.delivery_phone, go.notes, go.guest_email,
        go.distance_miles,
        json_agg(
          json_build_object(
            'product_id', goi.product_id,
            'product_name', p.name,
            'quantity', goi.quantity,
            'unit', p.unit,
            'unit_price', goi.unit_price,
            'total_price', goi.total_price,
            'image_url', p.image_url
          ) ORDER BY goi.id
        ) as items
      FROM grocery_orders go
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE go.id = $1 AND LOWER(go.guest_email) = LOWER($2)
      GROUP BY go.id`,
      [orderIdNum, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Order not found. Please check your order ID and email address.'
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Guest grocery order tracking error:', err);
    res.status(500).json({ error: 'Failed to retrieve order details' });
  }
});

/**
 * Get user's grocery orders
 * GET /api/grocery/my-orders
 */
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const result = await pool.query(
      `SELECT
        go.id, go.subtotal, go.platform_fee, go.delivery_fee, go.total,
        go.status, go.created_at, go.paid_at, go.delivered_at,
        go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
        go.delivery_name, go.delivery_phone, go.notes,
        json_agg(
          json_build_object(
            'product_id', goi.product_id,
            'product_name', p.name,
            'quantity', goi.quantity,
            'unit', p.unit,
            'unit_price', goi.unit_price,
            'total_price', goi.total_price,
            'image_url', p.image_url
          )
        ) as items
      FROM grocery_orders go
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE go.user_id = $1
      GROUP BY go.id
      ORDER BY go.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get grocery orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * Get single grocery order details
 * GET /api/grocery/order/:orderId
 */
router.get('/order/:orderId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = parseInt(req.params.orderId);

    const result = await pool.query(
      `SELECT
        go.id, go.subtotal, go.platform_fee, go.delivery_fee, go.total,
        go.status, go.created_at, go.paid_at, go.delivered_at,
        go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
        go.delivery_name, go.delivery_phone, go.notes, go.distance_miles,
        json_agg(
          json_build_object(
            'product_id', goi.product_id,
            'product_name', p.name,
            'quantity', goi.quantity,
            'unit', p.unit,
            'unit_price', goi.unit_price,
            'total_price', goi.total_price,
            'image_url', p.image_url,
            'category', p.category
          )
        ) as items
      FROM grocery_orders go
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE go.id = $1 AND go.user_id = $2
      GROUP BY go.id`,
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get grocery order error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * Update grocery order status (for admin/driver use)
 * PATCH /api/grocery/orders/:id/status
 */
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const validStatuses = ['pending', 'paid', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    // Update the order status
    const updateResult = await pool.query(
      `UPDATE grocery_orders
       SET status = $1, delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
       WHERE id = $2
       RETURNING id, user_id, total, status`,
      [status, orderId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = updateResult.rows[0];

    // If order is delivered, send completion email
    if (status === 'delivered') {
      try {
        // Get customer info
        const customerResult = await pool.query(
          `SELECT
            go.id, go.total, go.delivery_name, go.guest_email,
            u.name as user_name, u.email as user_email
           FROM grocery_orders go
           LEFT JOIN users u ON go.user_id = u.id
           WHERE go.id = $1`,
          [orderId]
        );

        if (customerResult.rows.length > 0) {
          const customer = customerResult.rows[0];
          const customerEmail = customer.user_email || customer.guest_email;
          const customerName = customer.user_name || customer.delivery_name || 'Customer';

          if (customerEmail) {
            sendOrderDeliveredEmail(customerEmail, customerName, {
              orderId: customer.id,
              total: parseFloat(customer.total),
              orderType: 'grocery',
              isGuestOrder: !!customer.guest_email
            }).catch(err => console.error('Failed to send grocery delivery email:', err));

            console.log(`✅ Grocery delivery email queued for ${customerEmail}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending grocery delivery email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (err) {
    console.error('Update grocery order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * Request refund for grocery order
 * POST /api/grocery/orders/:id/refund
 * Requires authentication
 */
router.post('/orders/:id/refund', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const orderId = parseInt(req.params.id);
    const userId = req.session.userId;
    const { reason, description } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const validReasons = [
      'customer_request',
      'order_cancelled',
      'item_unavailable',
      'quality_issue',
      'wrong_item',
      'late_delivery',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid refund reason' });
    }

    await client.query('BEGIN');

    // Get order details and verify ownership
    const orderResult = await client.query(
      `SELECT
        go.id, go.user_id, go.total, go.status, go.refund_status,
        go.delivery_name, go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
        json_agg(
          json_build_object(
            'product_id', goi.product_id,
            'product_name', p.name,
            'quantity', goi.quantity,
            'unit_price', goi.unit_price,
            'total_price', goi.total_price,
            'store_id', p.store_id
          )
        ) as items
      FROM grocery_orders go
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE go.id = $1 AND go.user_id = $2
      GROUP BY go.id`,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check if order can be refunded
    if (order.status !== 'paid' && order.status !== 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Order must be paid or delivered to request a refund',
        currentStatus: order.status
      });
    }

    if (order.refund_status === 'full') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order has already been fully refunded' });
    }

    // Create refund request record
    const refundResult = await client.query(
      `INSERT INTO grocery_refund_requests (
        grocery_order_id, user_id, amount, reason, description, status, requested_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING id`,
      [orderId, userId, order.total, reason, description || '']
    );

    const refundRequestId = refundResult.rows[0].id;

    // Update order refund status to pending
    await client.query(
      `UPDATE grocery_orders
       SET refund_status = 'pending'
       WHERE id = $1`,
      [orderId]
    );

    await client.query('COMMIT');

    // Get customer details for notifications
    const customerResult = await client.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    const customerName = customerResult.rows[0]?.name || order.delivery_name || 'Customer';
    const customerEmail = customerResult.rows[0]?.email || '';

    // Get store owner(s) and send notifications
    // Extract unique store IDs from items
    const storeIds = [...new Set(order.items.map(item => item.store_id).filter(Boolean))];

    for (const storeId of storeIds) {
      try {
        // products.store_id is grocery_stores.id — look up the owner through that table
        const ownerResult = await pool.query(
          `SELECT gso.id, gso.name, gso.email
           FROM grocery_store_owners gso
           JOIN grocery_stores gs ON gs.owner_id = gso.id
           WHERE gs.id = $1`,
          [storeId]
        );

        if (ownerResult.rows.length > 0) {
          const owner = ownerResult.rows[0];

          // Create in-app notification for grocery owner
          await pool.query(
            `INSERT INTO grocery_owner_notifications (
              grocery_owner_id, grocery_order_id, type, title, message, data
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              owner.id,
              orderId,
              'refund_request',
              `Refund Request for Order #${orderId}`,
              `${customerName} has requested a refund of $${parseFloat(order.total).toFixed(2)} for order #${orderId}. Reason: ${reason}`,
              JSON.stringify({
                orderId,
                customerName,
                customerEmail,
                refundAmount: parseFloat(order.total).toFixed(2),
                reason,
                description: description || ''
              })
            ]
          );

          console.log(`✅ In-app refund notification created for grocery owner ${owner.id}, order ${orderId}`);

          // Send email notification to grocery owner
          await sendGroceryRefundRequestEmail(owner.email, owner.name, {
            orderId,
            customerName,
            customerEmail,
            refundReason: description || reason,
            refundAmount: parseFloat(order.total),
            requestDate: new Date().toISOString()
          });

          console.log(`✅ Refund request email sent to grocery owner ${owner.email} for order ${orderId}`);
        }
      } catch (notificationError) {
        console.error(`❌ Failed to send refund notification for store ${storeId}:`, notificationError);
        // Continue with other stores even if one fails
      }
    }

    res.status(201).json({
      message: 'Refund request submitted successfully',
      refundRequestId,
      orderId,
      amount: order.total,
      status: 'pending'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Grocery refund request error:', err);
    res.status(500).json({ error: 'Failed to create refund request' });
  } finally {
    client.release();
  }
});

export default router;
