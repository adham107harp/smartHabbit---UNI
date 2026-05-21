import express, { Application as ExpressApp } from 'express';
import cors, { CorsOptions } from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { db } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/auth';
import { verifyToken } from './utils/auth';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import habitRoutes from './routes/habits';
import badgeRoutes from './routes/badges';
import challengeRoutes from './routes/challenges';
import socialRoutes from './routes/social';
import shopRoutes from './routes/shop';
import notificationRoutes from './routes/notifications';
import leaderboardRoutes from './routes/leaderboards';
import chatRoutes from './routes/chat';
import mysteryRoutes from './routes/mystery';
import adminRoutes from './routes/admin';
import onboardingRoutes from './routes/onboarding';

import { chatService } from './services/ChatService';
import { startPunishmentJob, stopPunishmentJob } from './jobs/punishmentJob';

/**
 * Shared CORS options for both HTTP and socket.io.
 * Allowlist comes from CORS_ORIGIN env. No more "everything goes in dev"
 * — wide-open dev CORS becomes wide-open prod the moment NODE_ENV slips.
 */
function buildCorsOptions(): CorsOptions {
  const allowedOrigins = new Set(config.cors.origin.filter(Boolean));
  return {
    origin: (origin, callback) => {
      // No origin = same-origin / curl / server-to-server — let through.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
        return callback(null, true);
      }
      // The literal string "null" appears for file:// pages.
      if (allowedOrigins.has('null') && origin === 'null') return callback(null, true);
      console.warn(`[cors] rejecting origin "${origin}" — not in allowlist`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  };
}

/**
 * Build the Express app — pure function so tests can wire it up
 * without binding a port (and without spawning sockets/cron).
 */
export function setupApp(): ExpressApp {
  const app = express();
  const corsOptions = buildCorsOptions();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors(corsOptions));
  app.use(compression());

  if (config.app.env !== 'test') {
    app.use(morgan('dev'));
  }

  // Tightened from 10mb to 1mb — DoS-friendly otherwise. Uploads go through
  // multer (multipart) so this only constrains JSON bodies.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.use(
    '/uploads',
    express.static(path.resolve(__dirname, '../uploads'), {
      maxAge: '7d',
      fallthrough: false
    })
  );

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { success: false, message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.app.env === 'test'
  });
  app.use('/api/', limiter);

  // Health check: actually pings the DB. 200 only if both app and DB respond.
  app.get('/health', async (_req, res) => {
    try {
      await db.query('SELECT 1 AS ok');
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (e: any) {
      res.status(503).json({
        status: 'unhealthy',
        component: 'database',
        message: e?.message ?? 'db query failed'
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/habits', habitRoutes);
  app.use('/api/badges', badgeRoutes);
  app.use('/api/challenges', challengeRoutes);
  app.use('/api/friends', socialRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/leaderboards', leaderboardRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/mystery', mysteryRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/onboarding', onboardingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Attach socket.io chat to an existing HTTP server using the same
 * CORS allowlist as the REST API.
 */
export function setupSockets(httpServer: http.Server): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: buildCorsOptions(),
    path: '/socket.io'
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') return next(new Error('No token'));
    const decoded = verifyToken(token);
    if (!decoded?.userId) return next(new Error('Invalid token'));
    (socket.data as any).userId = decoded.userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId as string;
    socket.join(`user:${userId}`);

    socket.on('chat:send', async (payload: { to?: string; body?: string }, ack?: Function) => {
      try {
        const to = String(payload?.to || '');
        const body = String(payload?.body || '');
        const msg = await chatService.sendMessage(userId, to, body);
        io.to(`user:${to}`).emit('chat:message', msg);
        socket.emit('chat:message', msg);
        if (typeof ack === 'function') ack({ ok: true, message: msg });
      } catch (e: any) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });

    socket.on('chat:typing', (payload: { to?: string; on?: boolean }) => {
      const to = String(payload?.to || '');
      if (!to) return;
      io.to(`user:${to}`).emit('chat:typing', {
        from: userId,
        on: !!payload?.on
      });
    });

    socket.on('chat:read', async (payload: { from?: string }) => {
      const from = String(payload?.from || '');
      if (!from) return;
      try {
        await chatService.markRead(userId, from);
        io.to(`user:${from}`).emit('chat:read', { by: userId });
      } catch { /* swallow */ }
    });

    socket.on('disconnect', () => { /* rooms auto-clean */ });
  });

  return io;
}

/**
 * Production entry point — only runs when this file is the main module
 * (or when invoked directly via `node`/`ts-node`). Tests import setupApp()
 * directly so they don't trigger the listen() or the punishment cron.
 */
class Server {
  private app: ExpressApp;
  private http: http.Server;
  private io: SocketIOServer;

  constructor() {
    this.app = setupApp();
    this.http = http.createServer(this.app);
    this.io = setupSockets(this.http);
  }

  async start(): Promise<void> {
    try {
      await db.connect();
      await db.runMigrations();
      this.http.listen(config.app.port, config.app.host, () => {
        console.log(`\n✓ SmartHabbit API + WS running at http://${config.app.host}:${config.app.port}`);
        console.log(`✓ Environment: ${config.app.env}`);
      });
      startPunishmentJob();
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Cleanly drain socket.io clients before tearing down the DB pool.
   * Without this, the process can hang for ~30s waiting on idle sockets.
   */
  async shutdown(signal: string): Promise<void> {
    console.log(`${signal} received: shutting down`);
    stopPunishmentJob();
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
    await db.disconnect();
    process.exit(0);
  }
}

// Boot only when this file is executed directly (not when imported by tests).
if (require.main === module) {
  const server = new Server();
  server.start();

  process.on('SIGTERM', () => server.shutdown('SIGTERM'));
  process.on('SIGINT',  () => server.shutdown('SIGINT'));
}
