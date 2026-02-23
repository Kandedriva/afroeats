import express from 'express';
import { requireDriverAuth, requireApprovedDriver } from '../middleware/driverAuth.js';
import {
  createDriverOnboardingLink,
  checkDriverStripeStatus
} from '../services/stripeDriverService.js';

const router = express.Router();

/**
 * POST /api/drivers/stripe/create-account
 * Create Stripe Connect account and get onboarding link
 * Requires: Driver logged in (approval not required for account creation)
 */
router.post('/create-account', requireDriverAuth, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';

    const refreshUrl = `${frontendUrl}/driver/profile?stripe=refresh`;
    const returnUrl = `${frontendUrl}/driver/profile?stripe=success`;

    const onboardingUrl = await createDriverOnboardingLink(driverId, refreshUrl, returnUrl);

    res.json({
      success: true,
      onboarding_url: onboardingUrl
    });
  } catch (error) {
    console.error('Driver Stripe account creation error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create Stripe account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/drivers/stripe/account-status
 * Check Stripe Connect account status
 * Requires: Driver logged in (approval not required for checking status)
 */
router.get('/account-status', requireDriverAuth, async (req, res) => {
  try {
    const driverId = req.driver.id;

    const status = await checkDriverStripeStatus(driverId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Driver Stripe account status error:', error);
    res.status(500).json({
      error: 'Failed to get account status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/drivers/stripe/refresh-onboarding
 * Get a fresh onboarding link (if previous one expired)
 * Requires: Driver logged in (approval not required for refreshing onboarding)
 */
router.post('/refresh-onboarding', requireDriverAuth, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';

    const refreshUrl = `${frontendUrl}/driver/profile?stripe=refresh`;
    const returnUrl = `${frontendUrl}/driver/profile?stripe=success`;

    const onboardingUrl = await createDriverOnboardingLink(driverId, refreshUrl, returnUrl);

    res.json({
      success: true,
      onboarding_url: onboardingUrl
    });
  } catch (error) {
    console.error('Driver Stripe refresh onboarding error:', error);
    res.status(500).json({
      error: 'Failed to refresh onboarding link',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
