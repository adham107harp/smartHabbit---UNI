import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    apiUrl: process.env.API_URL || 'http://localhost:3000'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'smarthabbit_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug'
  }
};
