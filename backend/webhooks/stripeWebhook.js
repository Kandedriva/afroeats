import stripe from '../stripe.js';
import pool from '../db.js';

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
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
          console.log(`Subscription activated for owner ${ownerId}`);
        } catch (err) {
          console.error('Database update error:', err);
        }
      } else if (session.mode === 'payment' && session.metadata.orderId) {
        // Handle order payment completion
        const orderId = session.metadata.orderId;
        const restaurantGroups = JSON.parse(session.metadata.restaurantGroups || '{}');
        
        try {
          // Update order status
          await pool.query(
            "UPDATE orders SET status = $1, stripe_session_id = $2, paid_at = NOW() WHERE id = $3",
            ['paid', session.id, orderId]
          );
          
          // Create transfers to restaurant owners
          for (const [restaurantId, group] of Object.entries(restaurantGroups)) {
            const restaurantAccountResult = await pool.query(
              "SELECT ro.stripe_account_id FROM restaurants r JOIN restaurant_owners ro ON r.owner_id = ro.id WHERE r.id = $1",
              [restaurantId]
            );
            
            if (restaurantAccountResult.rows.length > 0) {
              const stripeAccountId = restaurantAccountResult.rows[0].stripe_account_id;
              
              if (stripeAccountId) {
                // Transfer payment minus platform fee to restaurant owner
                const transferAmount = Math.round(group.total * 100); // Convert to cents
                
                await stripe.transfers.create({
                  amount: transferAmount,
                  currency: 'usd',
                  destination: stripeAccountId,
                  metadata: {
                    orderId: orderId,
                    restaurantId: restaurantId,
                  },
                });
                
                console.log(`Transferred $${group.total} to restaurant ${restaurantId}`);
              }
            }
          }
          
          console.log(`Order ${orderId} payment processed and funds distributed`);
        } catch (err) {
          console.error('Order payment processing error:', err);
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
          console.log(`Subscription cancelled for owner ${ownerId}`);
        }
      } catch (err) {
        console.error('Database update error:', err);
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};