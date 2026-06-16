import express from 'express';
import { authRateLimiter } from '../../middleware/rateLimit.js';
import {
  requestOtpUnifiedController,
  verifyOtpUnifiedController,
} from './identity.controller.js';

const router = express.Router();

// One pair of endpoints for both customers and drivers. Role is a hint only;
// the same OTP works for whichever role the caller verifies with.
router.post('/request-otp', authRateLimiter, requestOtpUnifiedController);
router.post('/verify-otp', authRateLimiter, verifyOtpUnifiedController);

export default router;
