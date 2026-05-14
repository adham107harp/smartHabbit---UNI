import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

const SALT_ROUNDS = 10;

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: object, expiryOverride?: string): string {
  const options: SignOptions = {
    expiresIn: (expiryOverride || config.jwt.expiry) as SignOptions['expiresIn']
  };
  return jwt.sign(payload, config.jwt.secret as jwt.Secret, options);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiry as SignOptions['expiresIn']
  };
  return jwt.sign({ userId, type: 'refresh' }, config.jwt.secret as jwt.Secret, options);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
}

/**
 * Decode token without verification
 */
export function decodeToken(token: string): any {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 500);
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format user response (remove sensitive data)
 */
export function formatUserResponse(user: any): any {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
