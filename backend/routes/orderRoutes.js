import express from "express";
import pool from "../db.js";
import stripe from "../stripe.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { userId, items, orderDetails } = req.body;

  if (!userId || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing user ID or cart items." });
  }

  try {
    // 1. Calculate total
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 2. Ensure order_details column exists
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
    } catch (err) {
      console.log("Column creation check:", err.message);
    }

    // 3. Insert order
    const result = await pool.query(
      "INSERT INTO orders (user_id, total, order_details) VALUES ($1, $2, $3) RETURNING id",
      [userId, total, orderDetails]
    );
    const orderId = result.rows[0].id;

    // 3. Insert order items
    const itemPromises = items.map(item => {
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    });

    await Promise.all(itemPromises);

    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (err) {
    console.error("Order Error:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// POST /api/orders/checkout-session - Create Stripe checkout session with multi-party payments
router.post("/checkout-session", requireAuth, async (req, res) => {
  try {
    const { items, orderDetails } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to checkout" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Check if Stripe is configured - if not, fall back to demo mode
    if (!stripe) {
      // Demo mode - create a demo checkout experience
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const platformFee = 1.20;
      const total = subtotal + platformFee;

      // Ensure order_details column exists
      try {
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
      } catch (err) {
        console.log("Column creation check:", err.message);
      }

      // Create order in database
      const orderResult = await pool.query(
        "INSERT INTO orders (user_id, total, order_details) VALUES ($1, $2, $3) RETURNING id",
        [userId, total, orderDetails]
      );
      const orderId = orderResult.rows[0].id;

      // Insert order items - simplified version without restaurant_id for now
      const itemPromises = items.map(item => {
        return pool.query(
          "INSERT INTO order_items (order_id, dish_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
          [orderId, item.id, item.name, item.price, item.quantity]
        );
      });
      await Promise.all(itemPromises);

      // DON'T clear the cart yet - wait until payment is completed in activate-demo

      return res.json({ 
        url: `http://localhost:3000/demo-order-checkout?order_id=${orderId}`,
        demo_mode: true,
        order_id: orderId
      });
    }

    // Stripe is configured - create real Stripe checkout session
    console.log("Creating Stripe checkout session");
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const platformFee = 1.20;
    const total = subtotal + platformFee;

    // Ensure necessary columns exist
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0");
    } catch (err) {
      console.log("Column creation check:", err.message);
    }

    // Create order in database first
    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, total, order_details, status, platform_fee) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [userId, total, orderDetails, 'pending', platformFee]
    );
    const orderId = orderResult.rows[0].id;

    // Insert order items
    const itemPromises = items.map(item => {
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    });
    await Promise.all(itemPromises);

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `From ${item.restaurantName || 'Restaurant'}`,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add platform fee as a line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Platform Fee',
          description: 'Service fee for using Afro Eats',
        },
        unit_amount: Math.round(platformFee * 100), // $1.20 in cents
      },
      quantity: 1,
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${process.env.CLIENT_URL}/order-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${process.env.CLIENT_URL}/cart?canceled=true`,
      metadata: {
        orderId: orderId.toString(),
        userId: userId.toString(),
      },
    });

    // Update order with session ID
    await pool.query(
      "UPDATE orders SET stripe_session_id = $1 WHERE id = $2",
      [session.id, orderId]
    );

    console.log("✅ Stripe checkout session created:", session.id);
    res.json({ url: session.url });

  } catch (err) {
    console.error("Checkout session creation error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: "Failed to create checkout session", details: err.message });
  }
});

// POST /api/orders/activate-demo - Activate demo order (mark as paid)
router.post("/activate-demo", requireAuth, async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.session.userId;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID required" });
    }

    // First, get the order to verify it belongs to the user and get order details
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [order_id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Get order items with restaurant information
    const itemsResult = await pool.query(`
      SELECT oi.*, d.restaurant_id, r.name as restaurant_name, ro.id as owner_id, ro.email as owner_email
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id  
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      WHERE oi.order_id = $1
    `, [order_id]);

    // Group items by restaurant for notifications
    const restaurantGroups = {};
    itemsResult.rows.forEach(item => {
      if (item.restaurant_id) {
        if (!restaurantGroups[item.restaurant_id]) {
          restaurantGroups[item.restaurant_id] = {
            restaurant_name: item.restaurant_name,
            owner_email: item.owner_email,
            items: [],
            total: 0
          };
        }
        restaurantGroups[item.restaurant_id].items.push(item);
        restaurantGroups[item.restaurant_id].total += item.price * item.quantity;
      }
    });

    // Log order completion for restaurant owners (in a real app, this would send emails/notifications)
    console.log("🎉 ORDER RECEIVED - Demo Mode");
    console.log("Order ID:", order_id);
    console.log("Customer:", userId);
    console.log("Total:", order.total);
    
    Object.values(restaurantGroups).forEach(group => {
      if (group.restaurant_name) {
        console.log(`📧 NOTIFICATION TO: ${group.restaurant_name} (${group.owner_email})`);
        console.log(`Items ordered:`, group.items.map(item => `${item.name} x${item.quantity}`));
        console.log(`Restaurant total: $${group.total.toFixed(2)}`);
        console.log("---");
      }
    });

    // Update order status to paid
    await pool.query(
      "UPDATE orders SET status = $1, paid_at = NOW() WHERE id = $2",
      ['paid', order_id]
    );

    // NOW clear the cart since payment is completed
    await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);

    console.log(`✅ Demo order ${order_id} activated successfully - cart cleared`);
    
    res.json({ 
      success: true, 
      message: "Demo order activated successfully",
      order_id: order_id,
      notifications_sent: Object.keys(restaurantGroups).length
    });
  } catch (err) {
    console.error("Demo order activation error:", err);
    res.status(500).json({ error: "Failed to activate demo order" });
  }
});

// GET /api/orders/:id - Get order details
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;

    // Get order with items
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      "SELECT oi.*, r.name as restaurant_name FROM order_items oi " +
      "LEFT JOIN dishes d ON oi.dish_id = d.id " +
      "LEFT JOIN restaurants r ON d.restaurant_id = r.id " +
      "WHERE oi.order_id = $1",
      [orderId]
    );

    res.json({
      ...order,
      items: itemsResult.rows
    });
  } catch (err) {
    console.error("Get order details error:", err);
    res.status(500).json({ error: "Failed to get order details" });
  }
});

// GET /api/orders/success - Handle successful payment
router.get("/success", async (req, res) => {
  try {
    const { session_id, order_id } = req.query;

    if (!session_id || !order_id) {
      return res.status(400).json({ error: "Missing session ID or order ID" });
    }

    if (!stripe) {
      // Demo mode - just mark order as paid
      await pool.query(
        "UPDATE orders SET status = $1, paid_at = NOW() WHERE id = $2",
        ['paid', order_id]
      );
      return res.json({ success: true, message: "Order confirmed (demo mode)" });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Update order status
      await pool.query(
        "UPDATE orders SET status = $1, paid_at = NOW() WHERE id = $2",
        ['paid', order_id]
      );
      
      // Clear user's cart after successful payment
      const orderResult = await pool.query("SELECT user_id FROM orders WHERE id = $1", [order_id]);
      if (orderResult.rows.length > 0) {
        const userId = orderResult.rows[0].user_id;
        await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);
      }
      
      console.log(`✅ Order ${order_id} paid successfully via Stripe`);
      res.json({ success: true, message: "Order confirmed and payment processed" });
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (err) {
    console.error("Order success handler error:", err);
    res.status(500).json({ error: "Failed to process order success" });
  }
});

// Original implementation commented out for debugging
/*
router.post("/checkout-session-ORIGINAL", requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to checkout" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Check if Stripe is configured
    if (!stripe) {
      // Demo mode - create a demo checkout experience
      console.log("Creating demo checkout session for order");
      
      // Ensure necessary columns exist
      try {
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0");
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
        await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER");
        console.log("Column creation check completed");
      } catch (err) {
        console.log("Column creation failed:", err.message);
      }
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const platformFee = 1.20;
      const total = subtotal + platformFee;

      // Create order in database
      console.log("Creating order with:", { userId, total, platformFee });
      const orderResult = await pool.query(
        "INSERT INTO orders (user_id, total, status, platform_fee) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, total, 'pending', platformFee]
      );
      const orderId = orderResult.rows[0].id;
      console.log("Order created with ID:", orderId);

      // Insert order items
      const itemPromises = items.map(item => {
        return pool.query(
          "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
          [orderId, item.id, item.name, item.price, item.quantity, item.restaurantId || item.restaurant_id]
        );
      });
      await Promise.all(itemPromises);

      // Clear the user's cart after creating the order
      await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);

      return res.json({ 
        url: `http://localhost:3000/demo-order-checkout?order_id=${orderId}`,
        demo_mode: true,
        order_id: orderId
      });
    }

    // Group items by restaurant to calculate individual payments
    const restaurantGroups = items.reduce((groups, item) => {
      const restaurantId = item.restaurantId || item.restaurant_id;
      if (!groups[restaurantId]) {
        groups[restaurantId] = {
          restaurantId,
          restaurantName: item.restaurantName || item.restaurant_name,
          items: [],
          total: 0
        };
      }
      groups[restaurantId].items.push(item);
      groups[restaurantId].total += item.price * item.quantity;
      return groups;
    }, {});

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const platformFee = 1.20; // $1.20 platform commission per order
    const total = subtotal + platformFee;

    // Get restaurant owners' Stripe account IDs
    const restaurantIds = Object.keys(restaurantGroups);
    const restaurantAccountsQuery = await pool.query(
      "SELECT r.id, r.name, ro.stripe_account_id FROM restaurants r " +
      "JOIN restaurant_owners ro ON r.owner_id = ro.id " +
      "WHERE r.id = ANY($1)",
      [restaurantIds]
    );

    const restaurantAccounts = restaurantAccountsQuery.rows.reduce((acc, row) => {
      acc[row.id] = {
        name: row.name,
        stripeAccountId: row.stripe_account_id
      };
      return acc;
    }, {});

    // Validate all restaurants have Stripe accounts
    for (const restaurantId of restaurantIds) {
      if (!restaurantAccounts[restaurantId]?.stripeAccountId) {
        return res.status(400).json({ 
          error: `Restaurant ${restaurantGroups[restaurantId].restaurantName} is not set up to receive payments` 
        });
      }
    }

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `From ${item.restaurantName || item.restaurant_name}`,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add platform fee as a line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Platform Fee',
          description: 'Service fee for using our platform',
        },
        unit_amount: Math.round(platformFee * 100), // $1.20 in cents
      },
      quantity: 1,
    });

    // Ensure necessary columns exist in orders table
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)");
    } catch (err) {
      console.log("Column creation failed - columns might already exist");
    }

    // Ensure necessary columns exist in order_items table  
    try {
      await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER");
    } catch (err) {
      console.log("Restaurant ID column creation failed - column might already exist");
    }

    // Create order in database first to get order ID
    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, total, status, platform_fee) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, total, 'pending', platformFee]
    );
    const orderId = orderResult.rows[0].id;

    // Insert order items
    const itemPromises = items.map(item => {
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [orderId, item.id, item.name, item.price, item.quantity, item.restaurantId || item.restaurant_id]
      );
    });
    await Promise.all(itemPromises);

    // Clear the user's cart after creating the order
    await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);

    // For multi-restaurant orders, we'll collect payment to our platform account
    // and then distribute to restaurant owners via transfers after payment succeeds
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `http://localhost:3000/order-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `http://localhost:3000/cart?canceled=true`,
      metadata: {
        orderId: orderId.toString(),
        userId: userId.toString(),
        restaurantGroups: JSON.stringify(restaurantGroups), // Store restaurant distribution for webhooks
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session creation error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: "Failed to create checkout session", details: err.message });
  }
});

// GET /api/orders/success - Handle successful payment
router.get("/success", async (req, res) => {
  try {
    const { session_id, order_id } = req.query;

    if (!session_id || !order_id) {
      return res.status(400).json({ error: "Missing session ID or order ID" });
    }

    if (!stripe) {
      // Demo mode - just mark order as paid
      await pool.query(
        "UPDATE orders SET status = $1, stripe_session_id = $2 WHERE id = $3",
        ['paid', session_id, order_id]
      );
      return res.json({ success: true, message: "Order confirmed (demo mode)" });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Update order status
      await pool.query(
        "UPDATE orders SET status = $1, stripe_session_id = $2, paid_at = NOW() WHERE id = $3",
        ['paid', session_id, order_id]
      );
      
      res.json({ success: true, message: "Order confirmed and payment processed" });
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (err) {
    console.error("Order success handler error:", err);
    res.status(500).json({ error: "Failed to process order success" });
  }
});

// GET /api/orders/:id - Get order details
router.get("/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in" });
    }

    // Get order with items
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      "SELECT oi.*, r.name as restaurant_name FROM order_items oi " +
      "LEFT JOIN restaurants r ON oi.restaurant_id = r.id " +
      "WHERE oi.order_id = $1",
      [orderId]
    );

    res.json({
      ...order,
      items: itemsResult.rows
    });
  } catch (err) {
    console.error("Get order details error:", err);
    res.status(500).json({ error: "Failed to get order details" });
  }
});
*/

export default router;
