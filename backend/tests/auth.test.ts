import request from 'supertest';
import { app, cleanDb, ensureMigrated, disconnect } from './_helpers/api';

beforeAll(async () => { await ensureMigrated(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await disconnect(); });

describe('POST /api/auth/register', () => {
  it('creates a new user + returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', email: 'new@test.local', password: 'Smoke123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('newuser');
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('rejects duplicate email/username with 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dup', email: 'dup@test.local', password: 'Smoke123!' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dup', email: 'dup@test.local', password: 'Smoke123!' });

    expect(res.status).toBe(409);
  });

  it('rejects weak passwords with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'weakpw', email: 'weak@test.local', password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'login_user', email: 'login@test.local', password: 'Smoke123!' });
  });

  it('200 on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.local', password: 'Smoke123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.local', password: 'Wrong-Pw1!' });

    expect(res.status).toBe(401);
  });

  it('401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: 'Smoke123!' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a fresh token pair given a valid refresh token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'refresher', email: 'r@test.local', password: 'Smoke123!' });
    const refreshToken: string = reg.body.data.refreshToken;

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('400 if refreshToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
  });
});
