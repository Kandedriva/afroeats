import stripe from '../stripe.js';
import pool from '../db.js';
import NotificationService from '../services/NotificationService.js';

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

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  res.json({ received: true });
};
