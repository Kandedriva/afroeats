import stripe from '../stripe.js';
import pool from '../db.js';

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    // Webhook signature verification failed
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      if (session.mode === 'payment' && session.metadata.orderData) {
        // Handle order payment completion - create order now that payment is confirmed
        try {
          // Parse order data from session metadata
          const orderData = JSON.parse(session.metadata.orderData);
          const restaurantTotals = JSON.parse(session.metadata.restaurantTotals);
          
          console.log("Webhook: Creating order after successful payment:", {
            sessionId: session.id,
            userId: orderData.userId,
            total: orderData.total
          });

          // Create the order in database since payment is confirmed
          const orderResult = await pool.query(
            "INSERT INTO orders (user_id, total, order_details, delivery_address, delivery_phone, delivery_type, restaurant_instructions, status, platform_fee, stripe_session_id, paid_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id",
            [
              orderData.userId,
              orderData.total,
              orderData.orderDetails,
              orderData.deliveryAddress,
              orderData.deliveryPhone,
              orderData.deliveryType,
              JSON.stringify(orderData.restaurantInstructions),
              'paid', // Start with 'paid' status since payment is confirmed
              orderData.platformFee,
              session.id
            ]
          );
          const orderId = orderResult.rows[0].id;

          // Insert order items with restaurant_id
          const itemPromises = orderData.items.map(item => {
            return pool.query(
              "INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6)",
              [orderId, item.dishId, item.name, item.price, item.quantity, item.restaurantId]
            );
          });
          await Promise.all(itemPromises);

          // Store restaurant payment info
          for (const [restaurantId, data] of Object.entries(restaurantTotals)) {
            const status = data.restaurant.stripe_account_id ? 'pending' : 'no_connect_account';
            await pool.query(
              `INSERT INTO restaurant_payments (order_id, restaurant_id, amount, stripe_account_id, status) 
               VALUES ($1, $2, $3, $4, $5)`,
              [orderId, restaurantId, data.total, data.restaurant.stripe_account_id, status]
            );
          }
          
          // Clear the customer's cart after successful payment
          await pool.query("DELETE FROM carts WHERE user_id = $1", [orderData.userId]);
          
          console.log("Webhook: Order created successfully after payment:", orderId);
          
          // Get restaurant payments that need to be processed
          const restaurantPaymentsResult = await pool.query(
            "SELECT * FROM restaurant_payments WHERE order_id = $1 AND status IN ('pending', 'no_connect_account')",
            [orderId]
          );
          
          // Create transfers to each restaurant (only for those with Stripe Connect)
          for (const payment of restaurantPaymentsResult.rows) {
            if (payment.stripe_account_id) {
              try {
                // Transfer payment to restaurant owner's connected account
                const transferAmount = Math.round(payment.amount * 100); // Convert to cents
                
                const transfer = await stripe.transfers.create({
                  amount: transferAmount,
                  currency: 'usd',
                  destination: payment.stripe_account_id,
                  metadata: {
                    orderId: orderId,
                    restaurantId: payment.restaurant_id.toString(),
                    paymentId: payment.id.toString(),
                  },
                });
                
                // Update payment record
                await pool.query(
                  "UPDATE restaurant_payments SET status = $1, stripe_transfer_id = $2, processed_at = NOW() WHERE id = $3",
                  ['completed', transfer.id, payment.id]
                );
                
                // Transferred payment to restaurant
              } catch (transferError) {
                // Transfer failed for restaurant
                
                // Mark as failed
                await pool.query(
                  "UPDATE restaurant_payments SET status = $1, processed_at = NOW() WHERE id = $2",
                  ['failed', payment.id]
                );
              }
            } else {
              // Test Mode: Restaurant has no Stripe Connect, payment will be held on platform
              
              // In test mode, mark as "awaiting_connect" instead of skipped
              await pool.query(
                "UPDATE restaurant_payments SET status = $1, processed_at = NOW() WHERE id = $2",
                ['awaiting_connect', payment.id]
              );
            }
          }
          
          // Order payment processed and funds distributed
        } catch (err) {
          // Order payment processing error
        }
      }
      break;
      
      
    default:
      // Unhandled event type
  }

  res.json({ received: true });
};