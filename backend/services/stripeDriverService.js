import stripe from '../stripe.js';
import pool from '../db.js';

/**
 * Create Stripe Express account for driver
 * @param {number} driverId - Driver ID
 * @param {string} driverEmail - Driver email
 * @returns {string} - Stripe account ID
 */
export async function createDriverStripeAccount(driverId, driverEmail) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }

    // Create Express account for the driver
    const account = await stripe.accounts.create({
      type: 'express',
      email: driverEmail,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        driver_id: driverId.toString(),
        account_type: 'driver'
      }
    });

    // Save account ID to database
    await pool.query(
      "UPDATE drivers SET stripe_account_id = $1, updated_at = NOW() WHERE id = $2",
      [account.id, driverId]
    );

    console.log(`✅ Created Stripe Express account for driver ${driverId}: ${account.id}`);

    return account.id;
  } catch (error) {
    console.error('Create driver Stripe account error:', error);
    throw error;
  }
}

/**
 * Create onboarding link for driver to complete Stripe Connect setup
 * @param {number} driverId - Driver ID
 * @param {string} refreshUrl - URL to redirect if onboarding needs refresh
 * @param {string} returnUrl - URL to redirect after successful onboarding
 * @returns {string} - Onboarding URL
 */
export async function createDriverOnboardingLink(driverId, refreshUrl, returnUrl) {
  try {
    const driver = await pool.query(
      "SELECT stripe_account_id, email FROM drivers WHERE id = $1",
      [driverId]
    );

    if (driver.rows.length === 0) {
      throw new Error('Driver not found');
    }

    let accountId = driver.rows[0].stripe_account_id;

    // Create account if doesn't exist
    if (!accountId) {
      accountId = await createDriverStripeAccount(driverId, driver.rows[0].email);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });

    console.log(`✅ Created onboarding link for driver ${driverId}`);

    return accountLink.url;
  } catch (error) {
    console.error('Create driver onboarding link error:', error);
    throw error;
  }
}

/**
 * Check and update driver's Stripe account status
 * @param {number} driverId - Driver ID
 * @returns {object} - Account status
 */
export async function checkDriverStripeStatus(driverId) {
  try {
    const driver = await pool.query(
      "SELECT stripe_account_id FROM drivers WHERE id = $1",
      [driverId]
    );

    if (driver.rows.length === 0 || !driver.rows[0].stripe_account_id) {
      return {
        has_account: false,
        onboarding_complete: false
      };
    }

    const accountId = driver.rows[0].stripe_account_id;

    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(accountId);

    const onboardingComplete = account.charges_enabled && account.payouts_enabled;

    // Update driver record with latest status
    await pool.query(
      `UPDATE drivers
       SET stripe_onboarding_complete = $1,
           stripe_charges_enabled = $2,
           stripe_payouts_enabled = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [onboardingComplete, account.charges_enabled, account.payouts_enabled, driverId]
    );

    return {
      has_account: true,
      onboarding_complete: onboardingComplete,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted
    };
  } catch (error) {
    console.error('Check driver Stripe status error:', error);
    throw error;
  }
}

/**
 * Create payout transfer to driver
 * @param {number} driverId - Driver ID
 * @param {number} deliveryId - Delivery ID
 * @param {number} amount - Amount in dollars
 * @returns {object} - Transfer object
 */
export async function createDriverPayout(driverId, deliveryId, amount) {
  try {
    const driver = await pool.query(
      "SELECT stripe_account_id, stripe_payouts_enabled FROM drivers WHERE id = $1",
      [driverId]
    );

    if (driver.rows.length === 0 || !driver.rows[0].stripe_account_id) {
      throw new Error('Driver Stripe account not found');
    }

    if (!driver.rows[0].stripe_payouts_enabled) {
      throw new Error('Driver Stripe account not ready for payouts');
    }

    const accountId = driver.rows[0].stripe_account_id;

    // Convert dollars to cents
    const amountCents = Math.round(parseFloat(amount) * 100);

    // Create transfer to driver's Stripe account
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: accountId,
      description: `Delivery payout for delivery #${deliveryId}`,
      metadata: {
        driver_id: driverId.toString(),
        delivery_id: deliveryId.toString()
      }
    });

    // Update earnings record with transfer ID and status
    await pool.query(
      `UPDATE driver_earnings
       SET stripe_transfer_id = $1, payout_status = 'paid', paid_at = NOW()
       WHERE delivery_id = $2`,
      [transfer.id, deliveryId]
    );

    // Update delivery record
    await pool.query(
      `UPDATE driver_deliveries
       SET driver_paid = TRUE, driver_payout_date = NOW(), stripe_transfer_id = $1
       WHERE id = $2`,
      [transfer.id, deliveryId]
    );

    console.log(`✅ Paid $${amount} to driver ${driverId} for delivery ${deliveryId} (transfer: ${transfer.id})`);

    return transfer;
  } catch (error) {
    console.error('Create driver payout error:', error);

    // Mark payout as failed
    await pool.query(
      `UPDATE driver_earnings SET payout_status = 'failed' WHERE delivery_id = $1`,
      [deliveryId]
    ).catch(err => console.error('Failed to mark payout as failed:', err));

    throw error;
  }
}

/**
 * Process pending driver payouts
 * This should be run periodically (e.g., daily via cron job)
 * Pays out deliveries that were completed more than 1 hour ago
 * @returns {object} - Summary of payouts processed
 */
export async function processPendingDriverPayouts() {
  try {
    // Ensure driver_earnings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_earnings (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        delivery_id INTEGER NOT NULL REFERENCES driver_deliveries(id) ON DELETE CASCADE,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        delivery_fee DECIMAL(10, 2) NOT NULL,
        driver_payout DECIMAL(10, 2) NOT NULL,
        platform_commission DECIMAL(10, 2) NOT NULL,
        stripe_transfer_id VARCHAR(255),
        payout_status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get all delivered orders with pending payouts (completed > 1 hour ago)
    const pendingPayouts = await pool.query(`
      SELECT
        de.id as earning_id,
        de.driver_id,
        de.delivery_id,
        de.driver_payout,
        dd.delivered_at,
        d.stripe_payouts_enabled
      FROM driver_earnings de
      INNER JOIN driver_deliveries dd ON de.delivery_id = dd.id
      INNER JOIN drivers d ON de.driver_id = d.id
      WHERE de.payout_status = 'pending'
        AND dd.status = 'delivered'
        AND dd.delivered_at < NOW() - INTERVAL '1 hour'
        AND d.stripe_payouts_enabled = TRUE
      ORDER BY dd.delivered_at ASC
    `);

    console.log(`💰 Processing ${pendingPayouts.rows.length} pending driver payouts...`);

    let successCount = 0;
    let failCount = 0;
    let totalAmount = 0;

    for (const payout of pendingPayouts.rows) {
      try {
        await createDriverPayout(
          payout.driver_id,
          payout.delivery_id,
          payout.driver_payout
        );

        successCount++;
        totalAmount += parseFloat(payout.driver_payout);

        console.log(`✓ Paid $${payout.driver_payout} to driver ${payout.driver_id} for delivery ${payout.delivery_id}`);

        // Create driver notification
        await pool.query(
          `INSERT INTO driver_notifications (driver_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            payout.driver_id,
            'payment_received',
            'Payment Received! 💰',
            `You received $${payout.driver_payout} for your delivery.`,
            JSON.stringify({ delivery_id: payout.delivery_id, amount: payout.driver_payout })
          ]
        );

      } catch (error) {
        console.error(`✗ Failed to pay driver ${payout.driver_id}:`, error.message);
        failCount++;

        // Create notification about failed payout
        await pool.query(
          `INSERT INTO driver_notifications (driver_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            payout.driver_id,
            'payment_failed',
            'Payment Issue ⚠️',
            `There was an issue processing your payment for a delivery. Our team will resolve this soon.`,
            JSON.stringify({ delivery_id: payout.delivery_id })
          ]
        ).catch(err => console.error('Failed to create notification:', err));
      }

      // Rate limiting: small delay between payouts
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ Driver payout processing complete:`);
    console.log(`   ✓ Success: ${successCount} payouts ($${totalAmount.toFixed(2)})`);
    console.log(`   ✗ Failed: ${failCount} payouts`);

    return {
      success: true,
      total: pendingPayouts.rows.length,
      succeeded: successCount,
      failed: failCount,
      total_amount: totalAmount
    };
  } catch (error) {
    console.error('Process pending payouts error:', error);
    throw error;
  }
}

export default {
  createDriverStripeAccount,
  createDriverOnboardingLink,
  checkDriverStripeStatus,
  createDriverPayout,
  processPendingDriverPayouts
};
