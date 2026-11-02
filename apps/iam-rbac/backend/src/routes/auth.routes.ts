import { Router } from 'express';
import {
  signup,
  signupSchema,
  verifyEmail,
  signinStep1,
  signinStep1Schema,
  signinStep2,
  signinStep2Schema,
  mfaVerify,
  mfaVerifySchema,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  setupMfa,
  enableMfa,
  registerPatient,
  patientRegisterSchema,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { rateLimitByIp } from '../middleware/rateLimit.middleware';

const router = Router();

// Rate-limited auth routes
router.post('/signup', rateLimitByIp(10, 60000), validateBody(signupSchema), signup);
router.post('/register', rateLimitByIp(10, 60000), validateBody(patientRegisterSchema), registerPatient);
router.post('/verify-email', verifyEmail);
router.post('/login', rateLimitByIp(20, 60000), signinStep2); // Direct login compatibility
router.post('/signin/step1', rateLimitByIp(30, 60000), validateBody(signinStep1Schema), signinStep1);
router.post('/signin/step2', rateLimitByIp(15, 60000), validateBody(signinStep2Schema), signinStep2);
router.post('/mfa/verify', rateLimitByIp(15, 60000), validateBody(mfaVerifySchema), mfaVerify);

router.post('/refresh', refreshToken);
router.post('/logout', logout);

router.post('/forgot-password', rateLimitByIp(5, 60000), forgotPassword);
router.post('/reset-password', rateLimitByIp(5, 60000), resetPassword);

// Authenticated session & MFA setup
router.get('/me', authenticate, getMe);
router.post('/mfa/setup', authenticate, setupMfa);
router.post('/mfa/enable', authenticate, enableMfa);

export default router;
