import express from 'express';
import { 
  createSubscriptionSession, 
  handleSubscriptionSuccess, 
  checkSubscriptionStatus,
  activateDemoSubscription
} from '../controllers/subscriptionController.js';

const router = express.Router();

// POST /api/subscription/create-session
router.post('/create-session', createSubscriptionSession);

// GET /api/subscription/success
router.get('/success', handleSubscriptionSuccess);

// GET /api/subscription/status
router.get('/status', checkSubscriptionStatus);

// POST /api/subscription/activate-demo (for demo mode)
router.post('/activate-demo', activateDemoSubscription);

export default router;