import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../config/database';

/**
 * Admin emails come from ADMIN_EMAILS (comma-separated). The default
 * matches the bootstrap row from migration 018.
 *
 * A user is treated as admin if EITHER:
 *   - users.is_admin is true (set by migration 018, never auto-revoked), OR
 *   - their email is in the env allowlist.
 *
 * The dual check means you can bring back the super-admin even if their
 * row got wiped during testing — log in once with the bootstrap email and
 * the auth route will set is_admin=true again.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'Adhamharp994@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Sign in first.' });
    return;
  }
  try {
    const row = await db.queryOne(
      'SELECT is_admin, email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.userId]
    );
    if (!row) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Sign in first.' });
      return;
    }
    if (row.is_admin || isAdminEmail(row.email)) {
      // If env-list-admin but flag is off, persist it for next request.
      if (!row.is_admin && isAdminEmail(row.email)) {
        await db.query('UPDATE users SET is_admin = true WHERE id = $1', [req.userId]);
      }
      next();
      return;
    }
    res.status(403).json({
      success: false,
      code: 'ADMIN_ONLY',
      message: 'This action requires admin privileges.'
    });
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to authorise admin.' });
  }
}
