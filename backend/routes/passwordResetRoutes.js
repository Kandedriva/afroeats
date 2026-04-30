/**
 * Password Reset Routes
 */

import express from 'express';
import { body } from 'express-validator';
import PasswordResetService from '../services/PasswordResetService.js';
import { asyncHandler, ApiResponse, Errors, handleValidationErrors } from '../utils/errorHandler.js';
import { jobs } from '../services/queue.js';

const router = express.Router();

/**
 * POST /api/password-reset/request
 * Request a password reset
 */
router.post(
  '/request',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('userType')
      .optional()
      .isIn(['customer', 'owner'])
      .withMessage('User type must be customer or owner'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, userType = 'customer' } = req.body;

    const result = await PasswordResetService.requestPasswordReset(email, userType);

    // If user exists, send reset email
    if (result.resetToken && result.user) {
      // Build reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const resetUrl = `${frontendUrl}/reset-password?token=${result.resetToken}&type=${userType}`;

      // Send email via queue
      try {
        await jobs.sendPasswordResetEmail(
          result.user.email,
          result.user.name,
          resetUrl,
          result.expiresAt
        );
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't throw error - we don't want to reveal if email exists
      }
    }

    // Always return success to prevent email enumeration
    res.json(
      ApiResponse.success(
        { message: result.message },
        'If an account with that email exists, a password reset link has been sent.'
      )
    );
  })
);

/**
 * POST /api/password-reset/verify
 * Verify reset token validity
 */
router.post(
  '/verify',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('userType')
      .optional()
      .isIn(['customer', 'owner'])
      .withMessage('User type must be customer or owner'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { token, userType = 'customer' } = req.body;

    const result = await PasswordResetService.verifyResetToken(token, userType);

    res.json(
      ApiResponse.success(
        { valid: true, userId: result.userId },
        'Reset token is valid'
      )
    );
  })
);

/**
 * POST /api/password-reset/reset
 * Reset password using token
 */
router.post(
  '/reset',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match'),
    body('userType')
      .optional()
      .isIn(['customer', 'owner'])
      .withMessage('User type must be customer or owner'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { token, newPassword, userType = 'customer' } = req.body;

    const result = await PasswordResetService.resetPassword(
      token,
      newPassword,
      userType
    );

    // Send confirmation email
    try {
      await jobs.sendPasswordChangeConfirmation(
        result.user.email,
        result.user.name || 'User'
      );
    } catch (emailError) {
      console.error('Failed to send password change confirmation:', emailError);
    }

    res.json(
      ApiResponse.success(
        { email: result.user.email },
        'Password has been reset successfully'
      )
    );
  })
);

/**
 * POST /api/password-reset/cleanup
 * Cleanup expired tokens (admin/cron endpoint)
 */
router.post(
  '/cleanup',
  asyncHandler(async (req, res) => {
    // TODO: Add admin authentication middleware
    const result = await PasswordResetService.cleanupExpiredTokens();

    res.json(
      ApiResponse.success(
        { deletedCount: result.deletedCount },
        'Expired tokens cleaned up'
      )
    );
  })
);

export default router;
