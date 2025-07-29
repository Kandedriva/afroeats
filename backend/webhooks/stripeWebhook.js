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
      
      if (session.mode === 'subscription') {
        const ownerId = session.metadata.ownerId;
        
        try {
          await pool.query(
            "UPDATE restaurant_owners SET is_subscribed = true WHERE id = $1",
            [ownerId]
          );
          // Subscription activated for owner
        } catch (err) {
          // Database update error
        }
      } else if (session.mode === 'payment' && session.metadata.orderId) {
        // Handle order payment completion with Connect transfers
        const orderId = session.metadata.orderId;
        const userId = session.metadata.userId;
        
        try {
          // Update order status
          await pool.query(
            "UPDATE orders SET status = $1, stripe_session_id = $2, paid_at = NOW() WHERE id = $3",
            ['paid', session.id, orderId]
          );
          
          // Clear the customer's cart after successful payment
          if (userId) {
            await pool.query("DELETE FROM carts WHERE user_id = $1", [userId]);
            // Cart cleared for user after successful payment
          }
          
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
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      
      try {
        // Find owner by stripe customer ID
        const ownerResult = await pool.query(
          "SELECT id FROM restaurant_owners WHERE stripe_customer_id = $1",
          [subscription.customer]
        );
        
        if (ownerResult.rows.length > 0) {
          const ownerId = ownerResult.rows[0].id;
          await pool.query(
            "UPDATE restaurant_owners SET is_subscribed = false WHERE id = $1",
            [ownerId]
          );
          // Subscription cancelled for owner
        }
      } catch (err) {
        // Database update error
      }
      break;
      
    default:
      // Unhandled event type
  }

  res.json({ received: true });
};