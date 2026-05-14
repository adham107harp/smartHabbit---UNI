import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

/**
 * Verify JWT token in Authorization header
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header'
      });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = verifyToken(token);

      if (decoded) {
        req.userId = decoded.userId;
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

/**
 * Error handling middleware
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  const status = error.status || 500;
  const message = error.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

/**
 * Not found middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
}
