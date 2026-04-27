import stripe from '../stripe.js';
import pool from '../db.js';
import NotificationService from '../services/NotificationService.js';
import socketService from '../services/socketService.js';
import {
  sendOrderConfirmationEmail,
  sendRestaurantOrderNotificationEmail,
  sendGroceryOrderNotificationEmail
} from '../services/emailService.js';

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✅ Webhook received: ${event.type}`);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;

      if (session.mode === 'payment') {
        try {
          console.log(`🔔 Processing checkout.session.completed for session: ${session.id}`);

          // Check if this is a grocery order from metadata
          const orderType = session.metadata?.orderType;

          if (orderType === 'grocery') {
            // Handle grocery order payment
            const orderId = parseInt(session.metadata.orderId);
            console.log(`🥬 Processing grocery order payment: ${orderId}`);

            await pool.query(
              `UPDATE grocery_orders
               SET status = 'paid', paid_at = NOW(), stripe_payment_intent = $1
               WHERE id = $2`,
              [session.payment_intent, orderId]
            );

            console.log(`✅ Grocery order ${orderId} marked as paid`);

            // Clear the user's grocery cart after successful payment
            const userId = session.metadata.userId;
            if (userId) {
              await pool.query(
                'DELETE FROM grocery_carts WHERE user_id = $1',
                [parseInt(userId)]
              );
              console.log(`✅ Cleared grocery cart for user ${userId}`);
            }

            // Send order confirmation email to customer
            try {
              const orderResult = await pool.query(
                `SELECT
                  go.id, go.subtotal, go.platform_fee, go.delivery_fee, go.total,
                  go.delivery_address, go.delivery_city, go.delivery_state, go.delivery_zip,
                  go.delivery_name, go.delivery_phone, go.user_id, go.guest_email,
                  u.name as user_name, u.email as user_email,
                  json_agg(
                    json_build_object(
                      'name', p.name,
                      'product_name', p.name,
                      'quantity', goi.quantity,
                      'price', goi.unit_price
                    )
                  ) as items
                FROM grocery_orders go
                LEFT JOIN users u ON go.user_id = u.id
                LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
                LEFT JOIN products p ON goi.product_id = p.id
                WHERE go.id = $1
                GROUP BY go.id, u.name, u.email`,
                [orderId]
              );

              if (orderResult.rows.length > 0) {
                const order = orderResult.rows[0];
                const customerEmail = order.user_email || order.guest_email;
                const customerName = order.user_name || order.delivery_name || 'Customer';

                if (customerEmail) {
                  await sendOrderConfirmationEmail(customerEmail, customerName, {
                    orderId: order.id,
                    items: order.items,
                    subtotal: parseFloat(order.subtotal),
                    deliveryFee: parseFloat(order.delivery_fee),
                    platformFee: parseFloat(order.platform_fee),
                    total: parseFloat(order.total),
                    orderType: 'grocery',
                    isGuestOrder: !!order.guest_email,
                    deliveryAddress: {
                      name: order.delivery_name,
                      address: order.delivery_address,
                      city: order.delivery_city,
                      state: order.delivery_state,
                      zipCode: order.delivery_zip,
                      phone: order.delivery_phone
                    }
                  });
                  console.log(`✅ Grocery order confirmation email sent to ${customerEmail}`);
                }
              }
            } catch (emailError) {
              console.error('❌ Failed to send grocery order confirmation email:', emailError);
            }

            // ✅ Send notification to grocery store owner
            try {
              // Get product details including store_id
              const productResult = await pool.query(
                `SELECT DISTINCT p.store_id
                 FROM grocery_order_items goi
                 JOIN products p ON goi.product_id = p.id
                 WHERE goi.grocery_order_id = $1
                 LIMIT 1`,
                [orderId]
              );

              if (productResult.rows.length > 0 && productResult.rows[0].store_id) {
                const storeId = productResult.rows[0].store_id;

                // Get grocery owner details
                const ownerResult = await pool.query(
                  'SELECT id, name, email FROM grocery_store_owners WHERE id = $1',
                  [storeId]
                );

                if (ownerResult.rows.length > 0) {
                  const owner = ownerResult.rows[0];
                  const orderData = orderResult.rows[0];
                  const customerEmail = orderData.user_email || orderData.guest_email;
                  const customerName = orderData.user_name || orderData.delivery_name || 'Customer';

                  // Create in-app notification
                  await pool.query(
                    `INSERT INTO grocery_owner_notifications (
                      grocery_owner_id, grocery_order_id, type, title, message, data
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      owner.id,
                      orderId,
                      'new_order',
                      `New Order #${orderId}`,
                      `You have a new grocery order from ${customerName} for $${parseFloat(orderData.total).toFixed(2)}`,
                      JSON.stringify({
                        orderId,
                        customerName,
                        total: parseFloat(orderData.total).toFixed(2)
                      })
                    ]
                  );

                  console.log(`✅ In-app notification created for grocery owner ${owner.id}, order ${orderId}`);

                  // Send email notification to grocery owner
                  await sendGroceryOrderNotificationEmail(owner.email, owner.name, {
                    orderId,
                    items: orderData.items,
                    total: parseFloat(orderData.total),
                    customerName,
                    customerPhone: orderData.delivery_phone,
                    deliveryAddress: orderData.delivery_address,
                    deliveryCity: orderData.delivery_city,
                    deliveryState: orderData.delivery_state,
                    deliveryZip: orderData.delivery_zip
                  });

                  console.log(`✅ Grocery owner notification email sent to ${owner.email} for order ${orderId}`);
                }
              }
            } catch (ownerNotificationError) {
              console.error('❌ Failed to send grocery owner notifications:', ownerNotificationError);
              // Don't fail the webhook if notification fails
            }

            // ✅ Handle Stripe Connect payout to grocery owner
            try {
              // Get order details and owner's Stripe account
              const payoutInfoResult = await pool.query(
                `SELECT
                  go.total, go.platform_fee, go.delivery_fee, go.subtotal,
                  gso.stripe_account_id, gso.stripe_charges_enabled,
                  gs.name as store_name
                 FROM grocery_orders go
                 JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
                 JOIN products p ON goi.product_id = p.id
                 JOIN grocery_store_owners gso ON p.store_id = gso.id
                 JOIN grocery_stores gs ON gso.id = gs.owner_id
                 WHERE go.id = $1
                 LIMIT 1`,
                [orderId]
              );

              if (payoutInfoResult.rows.length > 0) {
                const payoutInfo = payoutInfoResult.rows[0];

                if (payoutInfo.stripe_account_id && payoutInfo.stripe_charges_enabled) {
                  // Calculate payout amount
                  // Grocery owner gets: subtotal - platform_fee
                  // Platform keeps: platform_fee + delivery_fee
                  const platformFee = parseFloat(payoutInfo.platform_fee || 0);
                  const deliveryFee = parseFloat(payoutInfo.delivery_fee || 0);
                  const subtotal = parseFloat(payoutInfo.subtotal);

                  // Grocery owner receives subtotal minus their share of platform fee
                  const ownerAmount = Math.round((subtotal - platformFee) * 100); // in cents

                  if (ownerAmount >= 50) { // Minimum 50 cents ($0.50)
                    console.log(
                      `💸 Transferring $${(ownerAmount / 100).toFixed(2)} to grocery owner ${payoutInfo.stripe_account_id} for order ${orderId}`
                    );

                    const transfer = await stripe.transfers.create({
                      amount: ownerAmount,
                      currency: 'usd',
                      destination: payoutInfo.stripe_account_id,
                      transfer_group: `grocery_order_${orderId}`,
                      metadata: {
                        orderId: orderId.toString(),
                        orderType: 'grocery',
                        storeName: payoutInfo.store_name,
                        platformFee: platformFee.toFixed(2),
                        deliveryFee: deliveryFee.toFixed(2),
                      },
                    });

                    // Create payment record
                    await pool.query(
                      `INSERT INTO grocery_owner_payments (
                        grocery_order_id, grocery_owner_id, amount,
                        stripe_transfer_id, status, processed_at
                      ) SELECT $1, gso.id, $2, $3, 'completed', NOW()
                       FROM grocery_order_items goi
                       JOIN products p ON goi.product_id = p.id
                       JOIN grocery_store_owners gso ON p.store_id = gso.id
                       WHERE goi.grocery_order_id = $1
                       LIMIT 1
                       ON CONFLICT DO NOTHING`,
                      [orderId, (ownerAmount / 100).toFixed(2), transfer.id]
                    );

                    console.log(`✅ Transfer completed for grocery order ${orderId}: ${transfer.id}`);
                  } else {
                    console.warn(
                      `⚠️ Skipping transfer for order ${orderId}: Amount too small ($${(ownerAmount / 100).toFixed(2)})`
                    );
                  }
                } else {
                  console.log(
                    `⚠️ Grocery owner for order ${orderId} has no Stripe account or charges not enabled - payment held on platform`
                  );

                  // Create payment record as awaiting connection
                  await pool.query(
                    `INSERT INTO grocery_owner_payments (
                      grocery_order_id, grocery_owner_id, amount, status, processed_at
                    ) SELECT $1, gso.id, $2, 'awaiting_connect', NOW()
                     FROM grocery_order_items goi
                     JOIN products p ON goi.product_id = p.id
                     JOIN grocery_store_owners gso ON p.store_id = gso.id
                     WHERE goi.grocery_order_id = $1
                     LIMIT 1
                     ON CONFLICT DO NOTHING`,
                    [orderId, parseFloat(payoutInfo.subtotal) - parseFloat(payoutInfo.platform_fee)]
                  );
                }
              }
            } catch (payoutError) {
              console.error(`❌ Failed to process payout for grocery order ${orderId}:`, payoutError);
              // Don't fail the entire webhook if payout fails
            }

            break;
          }

          // Regular restaurant order handling
          // ✅ FIXED: Retrieve FULL order data from temp_order_data table
          const tempDataResult = await pool.query(
            'SELECT order_data FROM temp_order_data WHERE session_id = $1',
            [session.id]
          );

          if (tempDataResult.rows.length === 0) {
            console.error(`❌ No temp order data found for session: ${session.id}`);
            return res.status(200).json({ received: true, warning: 'No order data found' });
          }

          const orderData = tempDataResult.rows[0].order_data;
          const {
            userId,
            items,
            total,
            orderDetails,
            deliveryAddress,
            deliveryPhone,
            deliveryType,
            restaurantInstructions,
            platformFee,
            restaurantTotals,
          } = orderData;

          console.log(`📦 Creating order with ${items.length} items from ${Object.keys(restaurantTotals || {}).length} restaurant(s)`);
          console.log(`👤 User ID from order data: ${userId} (type: ${typeof userId})`);

          // Create the order in database
          const orderResult = await pool.query(
            `INSERT INTO orders (
              user_id, total, order_details, delivery_address, delivery_phone,
              delivery_type, restaurant_instructions, status, platform_fee,
              stripe_session_id, paid_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
            [
              userId,
              total,
              orderDetails || '',
              deliveryAddress,
              deliveryPhone,
              deliveryType || 'delivery',
              JSON.stringify(restaurantInstructions || {}),
              'received', // Order is paid and ready for restaurant to process
              platformFee || 0,
              session.id,
            ]
          );
          const orderId = orderResult.rows[0].id;

          console.log(`✅ Order created with ID: ${orderId}`);

          // Insert order items
          const itemPromises = items.map((item) =>
            pool.query(
              'INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)',
              [orderId, item.dishId, item.name, item.price, item.quantity, item.restaurantId]
            )
          );
          await Promise.all(itemPromises);

          console.log(`✅ Inserted ${items.length} order items`);

          // ✅ Create customer notification for order confirmation
          console.log(`🔔 Checking if should create customer notification. userId: ${userId}, type: ${typeof userId}`);

          // Handle userId as either number or string
          const numericUserId = userId ? parseInt(userId, 10) : null;

          if (numericUserId && !isNaN(numericUserId)) {
            try {
              // Ensure customer_notifications table exists
              await pool.query(`
                CREATE TABLE IF NOT EXISTS customer_notifications (
                  id SERIAL PRIMARY KEY,
                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                  type VARCHAR(50) NOT NULL,
                  title VARCHAR(255) NOT NULL,
                  message TEXT NOT NULL,
                  data JSONB DEFAULT '{}',
                  read BOOLEAN DEFAULT FALSE,
                  created_at TIMESTAMP DEFAULT NOW()
                )
              `);

              // Get restaurant names for the notification message
              const restaurantNames = Object.values(restaurantTotals || {})
                .map(r => r.restaurant.name)
                .join(', ');

              // Create notification
              await pool.query(
                `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  numericUserId,
                  orderId,
                  'order_confirmed',
                  'Order Confirmed! 🎉',
                  `Your order #${orderId} from ${restaurantNames} has been confirmed and is being prepared. You will be notified when it's ready.`,
                  JSON.stringify({
                    orderId,
                    total,
                    restaurantNames,
                    itemCount: items.length
                  })
                ]
              );

              console.log(`✅ Customer notification created for user ${numericUserId}, order ${orderId}`);

              // ✅ Send SMS to customer about order confirmation
              try {
                const { sendOrderStatusUpdateSMS } = require('../services/NotificationService.js');
                const customerPhone = deliveryPhone;

                if (customerPhone) {
                  await sendOrderStatusUpdateSMS(customerPhone, {
                    orderId,
                    status: 'received',
                    restaurantName: restaurantNames
                  });
                  console.log(`✅ Order confirmation SMS sent to customer: ${customerPhone}`);
                }
              } catch (smsError) {
                console.error('❌ Failed to send order confirmation SMS:', smsError.message);
              }

              // ✅ Send email confirmation to customer
              try {
                const customerResult = await pool.query(
                  'SELECT name, email FROM users WHERE id = $1',
                  [numericUserId]
                );

                if (customerResult.rows.length > 0) {
                  const customer = customerResult.rows[0];
                  const customerEmail = customer.email;
                  const customerName = customer.name;

                  // Prepare items with restaurant names
                  const itemsWithRestaurants = items.map(item => {
                    const restaurantId = item.restaurantId;
                    const restaurantName = restaurantTotals[restaurantId]?.restaurant?.name || 'Restaurant';
                    return {
                      ...item,
                      restaurant_name: restaurantName
                    };
                  });

                  // Calculate fees (assuming 10% delivery fee if delivery, 0 if pickup)
                  const deliveryFeeAmount = deliveryType === 'delivery' ? total * 0.1 : 0;
                  const subtotal = total - platformFee - deliveryFeeAmount;

                  await sendOrderConfirmationEmail(customerEmail, customerName, {
                    orderId,
                    items: itemsWithRestaurants,
                    subtotal,
                    deliveryFee: deliveryFeeAmount,
                    platformFee,
                    total,
                    orderType: 'food',
                    isGuestOrder: false,
                    deliveryAddress: deliveryType === 'delivery' ? {
                      name: customerName,
                      address: deliveryAddress,
                      city: '',
                      state: '',
                      zipCode: '',
                      phone: deliveryPhone
                    } : null
                  });
                  console.log(`✅ Order confirmation email sent to customer: ${customerEmail}`);
                }
              } catch (emailError) {
                console.error('❌ Failed to send order confirmation email:', emailError);
              }
            } catch (notifError) {
              console.error('❌ Failed to create customer notification:', notifError.message);
              console.error('❌ Notification error details:', notifError.stack);
            }
          } else {
            console.log(`⚠️ Skipping authenticated customer notification - no valid userId (userId: ${userId})`);

            // ✅ Handle guest order notifications
            const guestInfo = orderData.guestInfo;
            if (guestInfo && guestInfo.email) {
              console.log(`📧 Sending notifications to guest customer: ${guestInfo.email}`);

              try {
                const customerEmail = guestInfo.email;
                const customerName = guestInfo.name || 'Guest';
                const customerPhone = guestInfo.phone;

                // Get restaurant names for the notification message
                const restaurantNames = Object.values(restaurantTotals || {})
                  .map(r => r.restaurant.name)
                  .join(', ');

                // ✅ Send SMS to guest customer about order confirmation
                if (customerPhone) {
                  try {
                    const { sendOrderStatusUpdateSMS } = require('../services/NotificationService.js');
                    await sendOrderStatusUpdateSMS(customerPhone, {
                      orderId,
                      status: 'received',
                      restaurantName: restaurantNames
                    });
                    console.log(`✅ Order confirmation SMS sent to guest: ${customerPhone}`);
                  } catch (smsError) {
                    console.error('❌ Failed to send guest order confirmation SMS:', smsError.message);
                  }
                }

                // ✅ Send email confirmation to guest customer
                try {
                  // Prepare items with restaurant names
                  const itemsWithRestaurants = items.map(item => {
                    const restaurantId = item.restaurantId;
                    const restaurantName = restaurantTotals[restaurantId]?.restaurant?.name || 'Restaurant';
                    return {
                      ...item,
                      restaurant_name: restaurantName
                    };
                  });

                  // Calculate fees (assuming 10% delivery fee if delivery, 0 if pickup)
                  const deliveryFeeAmount = deliveryType === 'delivery' ? total * 0.1 : 0;
                  const subtotal = total - platformFee - deliveryFeeAmount;

                  await sendOrderConfirmationEmail(customerEmail, customerName, {
                    orderId,
                    items: itemsWithRestaurants,
                    subtotal,
                    deliveryFee: deliveryFeeAmount,
                    platformFee,
                    total,
                    orderType: 'food',
                    isGuestOrder: true,
                    deliveryAddress: deliveryType === 'delivery' ? {
                      name: customerName,
                      address: guestInfo.address || deliveryAddress,
                      city: '',
                      state: '',
                      zipCode: '',
                      phone: customerPhone
                    } : null
                  });
                  console.log(`✅ Order confirmation email sent to guest: ${customerEmail}`);
                } catch (emailError) {
                  console.error('❌ Failed to send guest order confirmation email:', emailError);
                }
              } catch (guestNotifError) {
                console.error('❌ Failed to send guest notifications:', guestNotifError.message);
              }
            }
          }

          // ✅ CRITICAL FIX: Send notifications to restaurant owners
          if (restaurantTotals && Object.keys(restaurantTotals).length > 0) {
            console.log(`🔔 Sending notifications to ${Object.keys(restaurantTotals).length} restaurant(s)`);

            // Get customer info for notifications
            let customerInfo = { name: 'Customer', email: '', phone: deliveryPhone || '' };
            if (userId) {
              const customerResult = await pool.query(
                'SELECT name, email, phone FROM users WHERE id = $1',
                [userId]
              );
              if (customerResult.rows.length > 0) {
                customerInfo = customerResult.rows[0];
              }
            } else if (orderData.guestInfo) {
              // Use guest info for restaurant notifications
              customerInfo = {
                name: orderData.guestInfo.name || 'Guest Customer',
                email: orderData.guestInfo.email || '',
                phone: orderData.guestInfo.phone || deliveryPhone || ''
              };
            }

            for (const [restaurantId, restaurantData] of Object.entries(restaurantTotals)) {
              try {
                const { restaurant, items: restaurantItems, total: restaurantTotal } = restaurantData;

                console.log(`📨 Creating notification for restaurant ${restaurant.name} (ID: ${restaurantId})`);

                // Get owner_id for this restaurant
                const ownerResult = await pool.query(
                  'SELECT owner_id FROM restaurants WHERE id = $1',
                  [restaurantId]
                );

                if (ownerResult.rows.length === 0) {
                  console.warn(`⚠️ No owner found for restaurant ${restaurantId}`);
                  continue;
                }

                const ownerId = ownerResult.rows[0].owner_id;

                // Ensure notifications table exists
                await pool.query(`
                  CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    owner_id INTEGER REFERENCES restaurant_owners(id) ON DELETE CASCADE,
                    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    data JSONB,
                    read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                  )
                `);

                // Create notification in database
                await pool.query(
                  `INSERT INTO notifications (
                    owner_id, order_id, type, title, message, data, created_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                  [
                    ownerId,
                    orderId,
                    'new_order',
                    `New Order #${orderId}`,
                    `You have a new order from ${customerInfo.name} for $${restaurantTotal.toFixed(2)}`,
                    JSON.stringify({
                      orderId,
                      customerName: customerInfo.name,
                      customerEmail: customerInfo.email,
                      customerPhone: customerInfo.phone,
                      items: restaurantItems.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                      })),
                      total: restaurantTotal,
                      deliveryType,
                      deliveryAddress,
                      orderDate: new Date().toISOString(),
                    }),
                  ]
                );

                console.log(`✅ Notification created for owner ${ownerId} (restaurant ${restaurant.name})`);

                // Store restaurant payment info for tracking
                await pool.query(
                  `INSERT INTO restaurant_payments (
                    order_id, restaurant_id, amount, stripe_account_id, status
                  ) VALUES ($1, $2, $3, $4, $5)`,
                  [
                    orderId,
                    restaurantId,
                    restaurantTotal,
                    restaurant.stripe_account_id || null,
                    restaurant.stripe_account_id ? 'pending' : 'no_connect_account',
                  ]
                );

                // ✅ Send email and SMS notifications to restaurant owner
                try {
                  // Get owner contact info (email from restaurant_owners, phone from restaurants)
                  const ownerInfoResult = await pool.query(
                    `SELECT
                      ro.name,
                      ro.email,
                      r.phone_number as phone
                     FROM restaurant_owners ro
                     JOIN restaurants r ON r.owner_id = ro.id
                     WHERE ro.id = $1 AND r.id = $2
                     LIMIT 1`,
                    [ownerId, restaurantId]
                  );

                  if (ownerInfoResult.rows.length > 0) {
                    const ownerInfo = ownerInfoResult.rows[0];

                    // Prepare order details for notification
                    const notificationDetails = {
                      orderId,
                      restaurantName: restaurant.name,
                      customerName: customerInfo.name,
                      customerPhone: customerInfo.phone,
                      items: restaurantItems.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                      })),
                      total: restaurantTotal,
                      deliveryType,
                      deliveryAddress,
                    };

                    // Send both email and SMS notifications
                    const notificationResults = await NotificationService.notifyRestaurantOwner(
                      ownerInfo,
                      notificationDetails
                    );

                    if (notificationResults.email.success) {
                      console.log(`📧 Email sent to ${ownerInfo.email} for order #${orderId}`);
                    } else {
                      console.log(`⚠️ Email failed: ${notificationResults.email.reason || notificationResults.email.error}`);
                    }

                    if (notificationResults.sms.success) {
                      console.log(`📱 SMS sent to ${ownerInfo.phone} for order #${orderId}`);
                    } else {
                      console.log(`⚠️ SMS failed: ${notificationResults.sms.reason || notificationResults.sms.error}`);
                    }

                    // Send SendGrid email notification
                    try {
                      await sendRestaurantOrderNotificationEmail(ownerInfo.email, restaurant.name, {
                        orderId,
                        items: restaurantItems.map((item) => ({
                          name: item.name,
                          quantity: item.quantity,
                          price: item.price
                        })),
                        subtotal: restaurantTotal,
                        customerName: customerInfo.name,
                        deliveryAddress: deliveryType === 'delivery' ? {
                          name: customerInfo.name,
                          address: deliveryAddress,
                          city: '',
                          state: '',
                          zipCode: '',
                          phone: customerInfo.phone
                        } : null
                      });
                      console.log(`✅ SendGrid email sent to restaurant ${restaurant.name}`);
                    } catch (sendGridError) {
                      console.error(`❌ Failed to send SendGrid email to restaurant ${restaurantId}:`, sendGridError);
                    }
                  }
                } catch (notificationError) {
                  console.error(`❌ Failed to send notifications for restaurant ${restaurantId}:`, notificationError);
                  // Don't throw - order was created successfully, notification is secondary
                }

              } catch (notifError) {
                console.error(`❌ Failed to notify restaurant ${restaurantId}:`, notifError);
                console.error(notifError.stack);
              }
            }
          }

          // ✅ Handle payment transfers to restaurant owners (if using Stripe Connect)
          if (restaurantTotals && stripe) {
            console.log(`💰 Processing payment transfers...`);

            // Platform fee is flat $1.20 per order, split proportionally among restaurants
            const totalPlatformFee = platformFee || 1.20;
            const totalOrderAmount = Object.values(restaurantTotals).reduce((sum, r) => sum + r.total, 0);

            console.log(`📊 Order totals - Total: $${totalOrderAmount.toFixed(2)}, Platform fee: $${totalPlatformFee.toFixed(2)}, Restaurants: ${Object.keys(restaurantTotals).length}`);

            for (const [restaurantId, restaurantData] of Object.entries(restaurantTotals)) {
              const { restaurant, total: restaurantTotal } = restaurantData;

              console.log(`🏪 Processing restaurant: ${restaurant.name}, Order total: $${restaurantTotal.toFixed(2)}`);

              if (restaurant.stripe_account_id) {
                try {
                  // Calculate proportional platform fee for this restaurant
                  // Each restaurant pays their share of the $1.20 based on their order percentage
                  const restaurantPercentage = restaurantTotal / totalOrderAmount;
                  const restaurantPlatformFee = Math.round(totalPlatformFee * restaurantPercentage * 100); // in cents
                  const restaurantAmount = Math.round(restaurantTotal * 100) - restaurantPlatformFee;

                  // Validate transfer amount (must be at least 1 cent)
                  if (restaurantAmount < 1) {
                    console.warn(
                      `⚠️ Skipping transfer to ${restaurant.name}: Amount too small ($${(restaurantAmount / 100).toFixed(2)}). Order total: $${restaurantTotal.toFixed(2)}, Platform fee share: $${(restaurantPlatformFee / 100).toFixed(2)}`
                    );

                    // Mark payment as completed with note about small amount
                    await pool.query(
                      'UPDATE restaurant_payments SET status = $1, processed_at = NOW() WHERE order_id = $2 AND restaurant_id = $3',
                      ['completed_no_transfer', orderId, restaurantId]
                    );
                    continue;
                  }

                  console.log(
                    `💸 Transferring $${(restaurantAmount / 100).toFixed(2)} to restaurant ${restaurant.name} (Their share of $1.20 platform fee: $${(restaurantPlatformFee / 100).toFixed(2)})`
                  );

                  // Transfer to restaurant (minus their portion of platform fee)
                  const transfer = await stripe.transfers.create({
                    amount: restaurantAmount,
                    currency: 'usd',
                    destination: restaurant.stripe_account_id,
                    metadata: {
                      orderId: orderId.toString(),
                      restaurantId: restaurantId.toString(),
                      restaurantName: restaurant.name,
                      platformFeeShare: (restaurantPlatformFee / 100).toFixed(2),
                    },
                  });

                  // Update payment record
                  await pool.query(
                    'UPDATE restaurant_payments SET status = $1, stripe_transfer_id = $2, processed_at = NOW() WHERE order_id = $3 AND restaurant_id = $4',
                    ['completed', transfer.id, orderId, restaurantId]
                  );

                  console.log(`✅ Transfer completed to ${restaurant.name}: ${transfer.id}`);
                } catch (transferError) {
                  console.error(`❌ Transfer failed for restaurant ${restaurant.name}:`, transferError.message);

                  // Mark payment as failed
                  await pool.query(
                    'UPDATE restaurant_payments SET status = $1, processed_at = NOW() WHERE order_id = $2 AND restaurant_id = $3',
                    ['failed', orderId, restaurantId]
                  );
                }
              } else {
                console.log(
                  `⚠️ Restaurant ${restaurant.name} has no Stripe Connect account - payment held on platform`
                );

                // Mark as awaiting connect setup
                await pool.query(
                  'UPDATE restaurant_payments SET status = $1, processed_at = NOW() WHERE order_id = $2 AND restaurant_id = $3',
                  ['awaiting_connect', orderId, restaurantId]
                );
              }
            }
          }

          // Clear user's cart
          if (userId) {
            await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]);
            console.log(`🛒 Cleared cart for user ${userId}`);
          }

          // ✅ Create delivery record if this is a delivery order
          if (deliveryType === 'delivery' && deliveryAddress) {
            try {
              const { calculateDistanceAndFee } = await import('../services/googleMapsService.js');

              // Get restaurant address(es) for pickup location
              const restaurantAddresses = await pool.query(`
                SELECT DISTINCT r.id, r.name, r.address, r.latitude, r.longitude
                FROM restaurants r
                INNER JOIN order_items oi ON r.id = oi.restaurant_id
                WHERE oi.order_id = $1
              `, [orderId]);

              if (restaurantAddresses.rows.length > 0) {
                // Use first restaurant as primary pickup location
                // For multi-restaurant orders, this could be enhanced to handle multiple pickups
                const primaryRestaurant = restaurantAddresses.rows[0];
                const pickupAddress = primaryRestaurant.address;

                // Calculate distance and delivery fee
                const deliveryData = await calculateDistanceAndFee(pickupAddress, deliveryAddress);

                // Create driver_deliveries record
                await pool.query(`
                  INSERT INTO driver_deliveries (
                    order_id, status, pickup_location, delivery_location,
                    pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
                    distance_miles, base_delivery_fee, distance_delivery_fee, total_delivery_fee,
                    driver_payout, platform_commission
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                  orderId,
                  'available', // Status is 'available' for drivers to claim
                  pickupAddress,
                  deliveryAddress,
                  deliveryData.origin_coordinates.latitude,
                  deliveryData.origin_coordinates.longitude,
                  deliveryData.destination_coordinates.latitude,
                  deliveryData.destination_coordinates.longitude,
                  deliveryData.distance_miles,
                  deliveryData.base_fee,
                  deliveryData.distance_fee,
                  deliveryData.total_delivery_fee,
                  deliveryData.driver_payout,
                  deliveryData.platform_commission
                ]);

                // Update order with delivery fee and distance
                await pool.query(
                  `UPDATE orders
                   SET actual_delivery_fee = $1, delivery_distance_miles = $2, pickup_location = $3
                   WHERE id = $4`,
                  [deliveryData.total_delivery_fee, deliveryData.distance_miles, pickupAddress, orderId]
                );

                console.log(`✅ Delivery record created for order ${orderId}: ${deliveryData.distance_miles} miles, fee: $${deliveryData.total_delivery_fee}`);

                // Notify all online drivers about new delivery order
                try {
                  socketService.emitToAllDrivers('new_delivery_order', {
                    orderId,
                    restaurantName: primaryRestaurant.name,
                    pickupAddress,
                    deliveryAddress,
                    distanceMiles: deliveryData.distance_miles,
                    driverPayout: deliveryData.driver_payout,
                    totalDeliveryFee: deliveryData.total_delivery_fee,
                    timestamp: new Date().toISOString(),
                  });
                  console.log(`📢 Notified drivers about new delivery order ${orderId}`);
                } catch (socketError) {
                  console.error('❌ Failed to notify drivers via socket:', socketError);
                  // Don't fail the order if socket notification fails
                }
              }
            } catch (deliveryError) {
              console.error('❌ Failed to create delivery record:', deliveryError);
              console.error('❌ Delivery error stack:', deliveryError.stack);
              // Don't fail the entire order if delivery record creation fails
            }
          }

          // Delete temp data
          await pool.query('DELETE FROM temp_order_data WHERE session_id = $1', [session.id]);
          console.log(`🗑️ Cleaned up temp data for session ${session.id}`);

          console.log(`✅ ✅ ✅ Order ${orderId} processing complete!`);
        } catch (err) {
          console.error('❌ Error processing checkout.session.completed:', err);
          console.error('❌ Error stack:', err.stack);
          // Return 200 so Stripe doesn't retry (we've logged the error)
        }
      }
      break;

    case 'payment_intent.succeeded':
      console.log(`💰 Payment intent succeeded: ${event.data.object.id}`);
      // Additional handling if needed
      break;

    case 'transfer.created':
      console.log(`💸 Transfer created: ${event.data.object.id}`);
      // Track transfer events if needed
      break;

    case 'refund.created':
      console.log(`💰 Refund created: ${event.data.object.id}`);
      try {
        const refund = event.data.object;
        // Update refund status in database if it exists
        const refundId = refund.metadata?.refund_id;
        if (refundId) {
          await pool.query(`
            UPDATE refunds
            SET status = 'processing', stripe_refund_id = $1, updated_at = NOW()
            WHERE id = $2
          `, [refund.id, refundId]);
          console.log(`✅ Updated refund ${refundId} to processing`);
        }
      } catch (err) {
        console.error('Error handling refund.created:', err);
      }
      break;

    case 'refund.updated':
      console.log(`💰 Refund updated: ${event.data.object.id}`);
      try {
        const refund = event.data.object;
        const refundId = refund.metadata?.refund_id;
        if (refundId && refund.status === 'succeeded') {
          // Update refund status
          await pool.query(`
            UPDATE refunds
            SET status = 'succeeded', succeeded_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [refundId]);

          // Get refund and user details for email
          const refundResult = await pool.query(`
            SELECT r.*, o.user_id
            FROM refunds r
            JOIN orders o ON r.order_id = o.id
            WHERE r.id = $1
          `, [refundId]);

          if (refundResult.rows.length > 0) {
            const refundData = refundResult.rows[0];
            if (refundData.user_id) {
              // Get user email
              const userResult = await pool.query(
                'SELECT email, name FROM users WHERE id = $1',
                [refundData.user_id]
              );

              if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                // Send success email asynchronously
                NotificationService.sendRefundCompletedEmail(user.email, user.name, {
                  refundId: refundData.id,
                  orderId: refundData.order_id,
                  amount: refundData.amount
                }).catch(err => {
                  console.error('Failed to send refund completed email:', err);
                });
              }
            }
          }

          console.log(`✅ Updated refund ${refundId} to succeeded and sent email`);
        } else if (refundId) {
          // Just update status for other statuses
          await pool.query(`
            UPDATE refunds
            SET status = $1, updated_at = NOW()
            WHERE id = $2
          `, [refund.status, refundId]);
          console.log(`✅ Updated refund ${refundId} to ${refund.status}`);
        }
      } catch (err) {
        console.error('Error handling refund.updated:', err);
      }
      break;

    case 'refund.failed':
      console.log(`❌ Refund failed: ${event.data.object.id}`);
      try {
        const refund = event.data.object;
        const refundId = refund.metadata?.refund_id;
        if (refundId) {
          await pool.query(`
            UPDATE refunds
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [refundId]);

          // Log the failure
          await pool.query(`
            INSERT INTO refund_logs (refund_id, action, old_status, new_status, notes)
            VALUES ($1, $2, $3, $4, $5)
          `, [refundId, 'failed', 'processing', 'failed', refund.failure_reason || 'Unknown failure']);

          // Get refund and user details for email
          const refundResult = await pool.query(`
            SELECT r.*, o.user_id
            FROM refunds r
            JOIN orders o ON r.order_id = o.id
            WHERE r.id = $1
          `, [refundId]);

          if (refundResult.rows.length > 0) {
            const refundData = refundResult.rows[0];
            if (refundData.user_id) {
              // Get user email
              const userResult = await pool.query(
                'SELECT email, name FROM users WHERE id = $1',
                [refundData.user_id]
              );

              if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                // Send failure email asynchronously
                NotificationService.sendRefundFailedEmail(user.email, user.name, {
                  refundId: refundData.id,
                  orderId: refundData.order_id,
                  amount: refundData.amount
                }).catch(err => {
                  console.error('Failed to send refund failed email:', err);
                });
              }
            }
          }

          console.log(`✅ Marked refund ${refundId} as failed and sent email`);
        }
      } catch (err) {
        console.error('Error handling refund.failed:', err);
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  res.json({ received: true });
};
