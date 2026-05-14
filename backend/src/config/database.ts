import { Pool, PoolClient } from 'pg';
import { config } from './index';
import fs from 'fs';
import path from 'path';

export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log('✓ Connected to PostgreSQL database');
      client.release();
    } catch (error) {
      console.error('✗ Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('✓ Database connection closed');
  }

  getPool(): Pool {
    return this.pool;
  }

  async query(text: string, params?: any[]): Promise<any[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async queryOne(text: string, params?: any[]): Promise<any | null> {
    const result = await this.pool.query(text, params);
    return result.rows[0] || null;
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations(): Promise<void> {
    // Track which migrations have been applied so we don't re-run them
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const already = await this.pool.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [file]
      );
      if (already.rowCount && already.rowCount > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await this.pool.query(sql);
        await this.pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        console.log(`✓ Migrated: ${file}`);
      } catch (error) {
        console.error(`✗ Migration failed: ${file}`, error);
        throw error;
      }
    }
  }
}

export const db = Database.getInstance();
