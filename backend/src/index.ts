import express, { Application as ExpressApp } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { db } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/auth';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import habitRoutes from './routes/habits';
import badgeRoutes from './routes/badges';
import challengeRoutes from './routes/challenges';
import socialRoutes from './routes/social';
import shopRoutes from './routes/shop';
import notificationRoutes from './routes/notifications';
import leaderboardRoutes from './routes/leaderboards';

class Server {
  private app: ExpressApp;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(helmet({ crossOriginResourcePolicy: false }));

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow same-origin requests, curl/Postman, and any whitelisted origin
          if (!origin) return callback(null, true);
          if (config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
            return callback(null, true);
          }
          // Permissive fallback in development
          if (config.app.env !== 'production') return callback(null, true);
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true
      })
    );

    this.app.use(morgan('dev'));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: { success: false, message: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private setupRoutes(): void {
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/habits', habitRoutes);
    this.app.use('/api/badges', badgeRoutes);
    this.app.use('/api/challenges', challengeRoutes);
    this.app.use('/api/friends', socialRoutes);
    this.app.use('/api/shop', shopRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/leaderboards', leaderboardRoutes);

    this.app.use(notFoundHandler);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      await db.connect();
      await db.runMigrations();
      this.app.listen(config.app.port, config.app.host, () => {
        console.log(`\n✓ SmartHabbit API running at http://${config.app.host}:${config.app.port}`);
        console.log(`✓ Environment: ${config.app.env}`);
      });
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }
}

const server = new Server();
server.start();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received: closing HTTP server');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received: closing HTTP server');
  await db.disconnect();
  process.exit(0);
});
