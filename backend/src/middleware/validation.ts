import { Request, Response, NextFunction } from 'express';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate request body against schema
 */
export function validateBody(rules: Record<string, ValidationRule>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (rule.type && typeof value !== rule.type) {
        errors.push({
          field,
          message: `${field} must be of type ${rule.type}`
        });
      }

      if (rule.minLength && value.length < rule.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${rule.minLength} characters`
        });
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({
          field,
          message: `${field} must not exceed ${rule.maxLength} characters`
        });
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({
          field,
          message: `${field} has invalid format`
        });
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          field,
          message: `${field} must be one of: ${rule.enum.join(', ')}`
        });
      }

      if (rule.validate && !rule.validate(value)) {
        errors.push({
          field,
          message: `${field} validation failed`
        });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
      return;
    }

    next();
  };
}

interface ValidationRule {
  required?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  validate?: (value: any) => boolean;
}
