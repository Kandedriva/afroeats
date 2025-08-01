import express from "express";
import pool from "../db.js";
import stripe from "../stripe.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { userId, items, orderDetails, deliveryAddress, deliveryPhone } = req.body;

  if (!userId || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing user ID or cart items." });
  }

  try {
    // 1. Calculate total
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 2. Ensure order_details, delivery_address, and delivery_phone columns exist
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20)");
    } catch (err) {
      // Column creation check handled silently
    }

    // 3. Insert order
    const result = await pool.query(
      "INSERT INTO orders (user_id, total, order_details, delivery_address, delivery_phone) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [userId, total, orderDetails, deliveryAddress, deliveryPhone]
    );
    const orderId = result.rows[0].id;

    // 3. Insert order items with restaurant_id
    const itemPromises = items.map(item => {
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [orderId, item.id, item.name, item.price, item.quantity, item.restaurantId || item.restaurant_id]
      );
    });

    await Promise.all(itemPromises);

    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (err) {
    res.status(500).json({ error: "Failed to place order" });
  }
});

// POST /api/orders/checkout-session - Create Stripe checkout session with Connect payment splitting
router.post("/checkout-session", requireAuth, async (req, res) => {
  console.log("=== CHECKOUT SESSION START ===");
  
  try {
    const { items, orderDetails, deliveryAddress, deliveryPhone, deliveryPreferences, restaurantInstructions } = req.body;
    const userId = req.session.userId;

    console.log("1. Request parsing successful");
    console.log("Checkout session request data:", {
      itemsCount: items?.length,
      hasDeliveryPreferences: !!deliveryPreferences,
      hasRestaurantInstructions: !!restaurantInstructions,
      userId,
      itemsSample: items?.slice(0, 2),
      deliveryPreferences,
      restaurantInstructions
    });

    if (!userId) {
      console.log("ERROR: No user ID in session");
      return res.status(401).json({ error: "Must be logged in to checkout" });
    }

    if (!items || items.length === 0) {
      console.log("ERROR: No items in cart");
      return res.status(400).json({ error: "Cart is empty" });
    }

    console.log("2. Basic validation passed");

    // Quick database connectivity test
    try {
      console.log("2.5. Testing database connectivity...");
      await pool.query("SELECT 1");
      console.log("Database connection OK");
    } catch (dbErr) {
      console.error("ERROR: Database connection failed:", dbErr);
      return res.status(500).json({ error: "Database connection failed" });
    }

    // Check if Stripe is configured - if not, fall back to demo mode
    if (!stripe) {
      console.log("3. Entering demo mode (Stripe not configured)");
      
      try {
        // Calculate totals
        console.log("4. Calculating totals...");
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const platformFee = 1.20;
        const total = subtotal + platformFee;
        console.log("Totals calculated:", { subtotal, platformFee, total });

        // Ensure order_details, delivery_address, delivery_phone, delivery_type, and restaurant_instructions columns exist
        console.log("5. Adding database columns if needed...");
        try {
          await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
          await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT");
          await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20)");
          await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'delivery'");
          await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_instructions JSONB");
          console.log("6. Database columns checked/added successfully");
        } catch (err) {
          console.error("ERROR: Database column creation failed:", err);
          throw err;
        }

        // Extract delivery information from deliveryPreferences or fallback to legacy parameters
        console.log("7. Processing delivery preferences...");
        const finalDeliveryType = deliveryPreferences?.type || 'delivery';
        const finalDeliveryAddress = deliveryPreferences?.address || deliveryAddress;
        const finalDeliveryPhone = deliveryPreferences?.phone || deliveryPhone;

        console.log("Demo mode order data:", {
          finalDeliveryType,
          finalDeliveryAddress,
          finalDeliveryPhone,
          restaurantInstructions
        });

        // Combine restaurant instructions into a single string for legacy support
        console.log("8. Processing restaurant instructions...");
        let combinedOrderDetails = orderDetails || '';
        
        try {
          if (restaurantInstructions && typeof restaurantInstructions === 'object') {
            const instructionEntries = Object.entries(restaurantInstructions)
              .filter(([restaurant, instructions]) => instructions && typeof instructions === 'string' && instructions.trim())
              .map(([restaurant, instructions]) => `${restaurant}: ${instructions.trim()}`);
            
            if (instructionEntries.length > 0) {
              combinedOrderDetails = instructionEntries.join(' | ');
            }
          }
          console.log("Combined order details:", combinedOrderDetails);
        } catch (err) {
          console.error("ERROR: Error processing restaurant instructions:", err);
          combinedOrderDetails = orderDetails || '';
        }

        // Create order in database
        console.log("9. Creating order in database...");
        console.log("Order params:", {
          userId,
          total,
          combinedOrderDetails,
          finalDeliveryAddress,
          finalDeliveryPhone,
          finalDeliveryType,
          restaurantInstructionsJSON: JSON.stringify(restaurantInstructions || null)
        });

        const orderResult = await pool.query(
          "INSERT INTO orders (user_id, total, order_details, delivery_address, delivery_phone, delivery_type, restaurant_instructions) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
          [userId, total, combinedOrderDetails, finalDeliveryAddress, finalDeliveryPhone, finalDeliveryType, JSON.stringify(restaurantInstructions || null)]
        );
        const orderId = orderResult.rows[0].id;
        console.log("10. Order created successfully with ID:", orderId);

        // Insert order items with restaurant_id for proper owner dashboard display
        console.log("11. Processing order items...");
        console.log("Demo mode - Processing items:", items.map(item => ({
          id: item.id,
          name: item.name,
          restaurantId: item.restaurantId,
          restaurant_id: item.restaurant_id
        })));

        const itemPromises = items.map((item, index) => {
          const restaurantId = item.restaurantId || item.restaurant_id || null;
          console.log(`Inserting item ${index + 1}/${items.length}: ${item.name} with restaurant_id: ${restaurantId}`);
          
          return pool.query(
            "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
            [orderId, item.id || null, item.name, item.price, item.quantity, restaurantId]
          ).catch(err => {
            console.error(`ERROR inserting item ${item.name}:`, err);
            throw err;
          });
        });
        
        await Promise.all(itemPromises);
        console.log("12. All order items inserted successfully");

        // Mark order as paid immediately in demo mode
        await pool.query(
          "UPDATE orders SET status = $1, paid_at = NOW() WHERE id = $2",
          ['paid', orderId]
        );

        // Clear the cart since payment is completed
        await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);
        
        console.log("13. Demo mode order creation completed successfully");

        const responseData = { 
          url: `http://localhost:3000/order-success?order_id=${orderId}&demo=true`,
          demo_mode: true,
          order_id: orderId
        };
        console.log("14. Sending response:", responseData);
        return res.json(responseData);
        
      } catch (demoError) {
        console.error("ERROR in demo mode section:", demoError);
        throw demoError;
      }
    }

    console.log("15. Entering Stripe Connect mode");
    
    // Get restaurant info for order processing
    const restaurantIds = [...new Set(items.map(item => item.restaurantId || item.restaurant_id))].filter(id => id);
    console.log("16. Restaurant IDs found in items:", restaurantIds);
    
    if (restaurantIds.length === 0) {
      console.error("ERROR: No restaurant IDs found in items");
      return res.status(400).json({ error: "Invalid cart data - missing restaurant information" });
    }
    
    const restaurantResults = await pool.query(
      `SELECT r.id, r.name, ro.stripe_account_id, ro.email as owner_email 
       FROM restaurants r 
       JOIN restaurant_owners ro ON r.owner_id = ro.id 
       WHERE r.id = ANY($1)`,
      [restaurantIds]
    );

    const restaurants = restaurantResults.rows;
    console.log("17. Restaurants fetched from database:", restaurants);
    
    // In test/development mode, proceed with order creation even without Connect accounts
    const missingConnectAccounts = restaurants.filter(r => !r.stripe_account_id);
    console.log("18. Missing Stripe Connect accounts:", missingConnectAccounts.length);
    
    // For development/test mode, we'll proceed even without Connect accounts
    // In production, you might want to require all restaurants to have Stripe accounts

    // Stripe Connect mode - create checkout session with payment splitting
    console.log("19. Starting Stripe checkout session creation");
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const platformFeeRate = 0.05; // 5% platform fee
    const platformFee = Math.round(subtotal * platformFeeRate * 100) / 100;
    const total = subtotal + platformFee;
    console.log("20. Totals calculated:", { subtotal, platformFee, total });

    // Ensure necessary columns and tables exist
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_details TEXT");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20)");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'delivery'");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_instructions JSONB");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0");
      await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id)");
      
      // Create restaurant_payments table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_payments (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          restaurant_id INTEGER REFERENCES restaurants(id),
          amount DECIMAL(10,2) NOT NULL,
          stripe_account_id VARCHAR(255),
          stripe_transfer_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'pending',
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      // Database setup error handled silently
    }

    // Extract delivery information from deliveryPreferences or fallback to legacy parameters
    const finalDeliveryType = deliveryPreferences?.type || 'delivery';
    const finalDeliveryAddress = deliveryPreferences?.address || deliveryAddress;
    const finalDeliveryPhone = deliveryPreferences?.phone || deliveryPhone;

    // Combine restaurant instructions into a single string for legacy support
    let combinedOrderDetails = orderDetails || '';
    
    try {
      if (restaurantInstructions && typeof restaurantInstructions === 'object') {
        const instructionEntries = Object.entries(restaurantInstructions)
          .filter(([restaurant, instructions]) => instructions && typeof instructions === 'string' && instructions.trim())
          .map(([restaurant, instructions]) => `${restaurant}: ${instructions.trim()}`);
        
        if (instructionEntries.length > 0) {
          combinedOrderDetails = instructionEntries.join(' | ');
        }
      }
    } catch (err) {
      console.error("Error processing restaurant instructions:", err);
      combinedOrderDetails = orderDetails || '';
    }

    // Create order in database first
    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, total, order_details, delivery_address, delivery_phone, delivery_type, restaurant_instructions, status, platform_fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
      [userId, total, combinedOrderDetails, finalDeliveryAddress, finalDeliveryPhone, finalDeliveryType, JSON.stringify(restaurantInstructions || null), 'pending', platformFee]
    );
    const orderId = orderResult.rows[0].id;

    // Insert order items with restaurant_id
    const itemPromises = items.map(item => {
      const restaurantId = item.restaurantId || item.restaurant_id || null;
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [orderId, item.id, item.name, item.price, item.quantity, restaurantId]
      );
    });
    await Promise.all(itemPromises);

    // Group items by restaurant for payment splitting
    const restaurantTotals = {};
    items.forEach(item => {
      const restaurantId = item.restaurantId || item.restaurant_id;
      if (!restaurantId) {
        console.warn("Item missing restaurant ID:", item);
        return;
      }
      
      const itemTotal = item.price * item.quantity;
      if (!restaurantTotals[restaurantId]) {
        const restaurant = restaurants.find(r => r.id == restaurantId);
        if (!restaurant) {
          console.warn(`Restaurant not found for ID ${restaurantId}`);
        }
        restaurantTotals[restaurantId] = { 
          total: 0, 
          items: [],
          restaurant: restaurant || { id: restaurantId, name: 'Unknown Restaurant', stripe_account_id: null }
        };
      }
      restaurantTotals[restaurantId].total += itemTotal;
      restaurantTotals[restaurantId].items.push(item);
    });

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
          name: 'Platform Fee (5%)',
          description: 'Service fee for using A Food Zone platform',
        },
        unit_amount: Math.round(platformFee * 100),
      },
      quantity: 1,
    });

    // Create Stripe checkout session (customer pays the full amount)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `http://localhost:3000/order-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `http://localhost:3000/cart?canceled=true`,
      metadata: {
        orderId: orderId.toString(),
        userId: userId.toString(),
        platformFee: platformFee.toString(),
        restaurantCount: Object.keys(restaurantTotals).length.toString()
      },
    });

    // Update order with session ID and restaurant payment data
    await pool.query(
      "UPDATE orders SET stripe_session_id = $1 WHERE id = $2",
      [session.id, orderId]
    );

    // Store restaurant payment info for later processing
    for (const [restaurantId, data] of Object.entries(restaurantTotals)) {
      const status = data.restaurant.stripe_account_id ? 'pending' : 'no_connect_account';
      await pool.query(
        `INSERT INTO restaurant_payments (order_id, restaurant_id, amount, stripe_account_id, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, restaurantId, data.total, data.restaurant.stripe_account_id, status]
      );
    }

    res.json({ url: session.url });

  } catch (err) {
    console.error("=== CHECKOUT SESSION ERROR ===");
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    console.error("=== END ERROR ===");
    res.status(500).json({ 
      error: "Failed to create checkout session", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
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

    // Get order items with restaurant contact info
    const itemsResult = await pool.query(
      "SELECT oi.*, r.name as restaurant_name, r.phone_number as restaurant_phone FROM order_items oi " +
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
    // Get order details error
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
      
      res.json({ success: true, message: "Order confirmed and payment processed" });
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (err) {
    // Order success handler error
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
      // Creating demo checkout session for order
      
      // Ensure necessary columns exist
      try {
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0");
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
        await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER");
        // Column creation check completed
      } catch (err) {
        // Column creation failed
      }
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const platformFee = 1.20;
      const total = subtotal + platformFee;

      // Create order in database
      // Creating order with details
      const orderResult = await pool.query(
        "INSERT INTO orders (user_id, total, status, platform_fee) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, total, 'pending', platformFee]
      );
      const orderId = orderResult.rows[0].id;
      // Order created with ID

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
      // Column creation failed - columns might already exist
    }

    // Ensure necessary columns exist in order_items table  
    try {
      await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER");
    } catch (err) {
      // Restaurant ID column creation failed - column might already exist
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
    // Checkout session creation error
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
    // Order success handler error
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
    // Get order details error
    res.status(500).json({ error: "Failed to get order details" });
  }
});
*/

export default router;
