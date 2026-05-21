/**
 * Shared test harness.
 * - Builds the app via setupApp() (no listen()).
 * - Wraps each test in a clean DB via TRUNCATE.
 * - Provides helpers to register/login a user and grab a Bearer token.
 *
 * IMPORTANT: tests run against the LOCAL Postgres (the same DB the dev
 * server uses). They TRUNCATE every relevant table on each test, so don't
 * run these against a database you care about — point DB_NAME at a scratch
 * DB if you have real data.
 */

// Set test env BEFORE any module loads so config.ts + auth limiters see it.
process.env.NODE_ENV = 'test';
// Default to a dedicated DB so npm test never wipes the dev data.
// User can override DB_NAME if they want, but it MUST contain "test" so we
// don't accidentally truncate a real database.
process.env.DB_NAME = process.env.DB_NAME || 'smarthabbit_test';

if (!/test/i.test(process.env.DB_NAME)) {
  throw new Error(
    `Refusing to run tests against DB "${process.env.DB_NAME}" — name must contain "test". ` +
    `Set DB_NAME=smarthabbit_test (and CREATE DATABASE smarthabbit_test if it doesn't exist).`
  );
}

import request from 'supertest';
import bcrypt from 'bcrypt';
import { setupApp } from '../../src/index';
import { db } from '../../src/config/database';

export const app = setupApp();

/** Run migrations once per test session before tables get TRUNCATE'd. */
let migrated = false;
export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  await db.runMigrations();
  migrated = true;
}

/**
 * Wipe every table we touch, in dependency order.
 * Keeps `badges` and `reward_shop` (seed catalog) intact so tests can
 * assert against the catalog.
 */
export async function cleanDb(): Promise<void> {
  await db.query(`
    TRUNCATE TABLE
      chat_messages,
      notifications,
      friends,
      purchases,
      user_challenges,
      user_badges,
      habit_logs,
      habits,
      users
    RESTART IDENTITY CASCADE
  `);
}

export async function disconnect(): Promise<void> {
  await db.disconnect();
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  token: string;
}

/**
 * Registers a fresh user through the API + returns the token. The IP-based
 * auth rate limiter is disabled in test mode so we don't trip on bulk runs.
 */
let userCounter = 0;
export async function makeUser(overrides: Partial<{ username: string; email: string; password: string }> = {}): Promise<TestUser> {
  userCounter += 1;
  const stamp = `${Date.now()}_${userCounter}`;
  const username = overrides.username || `tester${stamp}`;
  const email    = overrides.email    || `tester${stamp}@test.local`;
  const password = overrides.password || 'Smoke123!';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password });

  if (res.status !== 201) {
    throw new Error(`makeUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.data.user.id,
    username,
    email,
    password,
    token: res.body.data.accessToken
  };
}

/**
 * Direct DB insert of a fully-formed user, bypassing the API. Useful when
 * the test wants to set up users en masse without paying the bcrypt cost
 * for each one or when validating a username regex that the API rejects.
 */
export async function insertUserDirect(opts: { username: string; email: string; password: string }): Promise<string> {
  const hash = await bcrypt.hash(opts.password, 4); // cheap for tests
  const row = await db.queryOne(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3) RETURNING id`,
    [opts.username, opts.email, hash]
  );
  return row.id;
}

export function authHeader(t: TestUser): Record<string, string> {
  return { Authorization: `Bearer ${t.token}` };
}
