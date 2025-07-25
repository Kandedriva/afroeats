import express from 'express';
import { requireOwnerAuth } from '../middleware/ownerAuth.js';
import { 
  createSubscriptionSession, 
  handleSubscriptionSuccess, 
  checkSubscriptionStatus,
  activateDemoSubscription
} from '../controllers/subscriptionController.js';

const router = express.Router();

// POST /api/subscription/create-session
router.post('/create-session', requireOwnerAuth, createSubscriptionSession);

// GET /api/subscription/success
router.get('/success', handleSubscriptionSuccess);

// GET /api/subscription/status
router.get('/status', requireOwnerAuth, checkSubscriptionStatus);

// POST /api/subscription/activate-demo (for demo mode)
router.post('/activate-demo', requireOwnerAuth, activateDemoSubscription);

export default router;