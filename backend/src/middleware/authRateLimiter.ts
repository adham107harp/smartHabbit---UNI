import rateLimit from 'express-rate-limit';

/**
 * Tight rate limit for /api/auth/* — prevents password brute-force.
 *
 * 5 attempts per 15 minutes per IP. Successful logins don't burn the quota
 * (skipSuccessfulRequests), so a legitimate user who occasionally typos
 * their password isn't locked out after one good login.
 *
 * In test mode (NODE_ENV=test) we disable the limiter so the test suite
 * isn't tripping over itself; production / dev keep it on.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT',
    message: 'Too many attempts. Try again in 15 minutes.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});
