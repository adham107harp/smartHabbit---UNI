import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateRefreshToken,
  validateEmail,
  validateUsername,
  validatePassword,
  formatUserResponse
} from '../utils/auth';
import { validateBody } from '../middleware/validation';
import { authRateLimiter } from '../middleware/authRateLimiter';
import { isAdminEmail } from '../middleware/requireAdmin';

const router = Router();

/**
 * POST /api/auth/register - Create new account
 */
router.post(
  '/register',
  authRateLimiter,
  validateBody({
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string', minLength: 8 }
  }),
  async (req: Request, res: Response) => {
    try {
      const { username, email, password } = req.body;

      // Validate email
      if (!validateEmail(email)) {
        res.status(400).json({ success: false, message: 'Invalid email format' });
        return;
      }

      // Validate username
      if (!validateUsername(username)) {
        res.status(400).json({
          success: false,
          message: 'Username must be 3-50 alphanumeric characters'
        });
        return;
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        });
        return;
      }

      // Check if user exists
      const existingUser = await db.queryOne(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'Username or email already exists'
        });
        return;
      }

      // Hash password and create user
      const passwordHash = await hashPassword(password);
      const adminFlag = isAdminEmail(email);
      const user = await db.queryOne(
        `INSERT INTO users (username, email, password_hash, is_admin)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, xp, level, coins, is_admin, created_at`,
        [username, email, passwordHash, adminFlag]
      );

      const accessToken = generateToken({ userId: user.id, username: user.username });
      const refreshToken = generateRefreshToken(user.id);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: formatUserResponse(user),
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }
);

/**
 * POST /api/auth/login - Authenticate user
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody({
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Get user
      const user = await db.queryOne(
        'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
        [email]
      );

      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      // Verify password
      const passwordMatch = await verifyPassword(password, user.password_hash);
      if (!passwordMatch) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      // If this email is on the admin allowlist but the flag isn't set,
      // upgrade them now. (e.g., the bootstrap row got dropped and the
      // user re-registered — they should still be admin.)
      if (isAdminEmail(user.email) && !user.is_admin) {
        await db.query('UPDATE users SET is_admin = true WHERE id = $1', [user.id]);
        user.is_admin = true;
      }

      const accessToken = generateToken({ userId: user.id, username: user.username });
      const refreshToken = generateRefreshToken(user.id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: formatUserResponse(user),
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }
);

/**
 * POST /api/auth/refresh - Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token required' });
      return;
    }

    // Verify refresh token
    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const accessToken = generateToken({ userId: decoded.userId });
    const newRefreshToken = generateRefreshToken(decoded.userId);

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
});

export default router;
