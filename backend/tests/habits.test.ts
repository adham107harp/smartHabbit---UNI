import request from 'supertest';
import { app, cleanDb, ensureMigrated, disconnect, makeUser, authHeader } from './_helpers/api';

beforeAll(async () => { await ensureMigrated(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await disconnect(); });

describe('POST /api/habits — create', () => {
  it('creates and lists a habit', async () => {
    const u = await makeUser();
    const create = await request(app)
      .post('/api/habits')
      .set(authHeader(u))
      .send({
        name: 'Read 20 min',
        goal_type: 'daily',
        difficulty: 'easy',
        target_value: 1
      });

    expect(create.status).toBe(201);
    expect(create.body.data.habit.user_id).toBe(u.id);

    const list = await request(app)
      .get('/api/habits')
      .set(authHeader(u));

    expect(list.status).toBe(200);
    expect(list.body.data.habits.length).toBe(1);
    expect(list.body.data.habits[0].name).toBe('Read 20 min');
  });

  it('rejects an unknown difficulty', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/habits')
      .set(authHeader(u))
      .send({ name: 'x', goal_type: 'daily', difficulty: 'extreme', target_value: 1 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/habits/:id/log — log + reward', () => {
  it('awards XP and coins and starts the streak at 1', async () => {
    const u = await makeUser();
    const h = await request(app)
      .post('/api/habits')
      .set(authHeader(u))
      .send({ name: 'Drink Water', goal_type: 'daily', difficulty: 'easy', target_value: 1 });

    const log = await request(app)
      .post(`/api/habits/${h.body.data.habit.id}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(log.status).toBe(200);
    expect(log.body.data.habitCompletion.xpEarned).toBeGreaterThanOrEqual(10);
    expect(log.body.data.streak.newStreak).toBe(1);
  });

  it('returns 409 HABIT_ALREADY_LOGGED on duplicate same-day log', async () => {
    const u = await makeUser();
    const h = await request(app)
      .post('/api/habits')
      .set(authHeader(u))
      .send({ name: 'Walk', goal_type: 'daily', difficulty: 'easy', target_value: 1 });

    await request(app)
      .post(`/api/habits/${h.body.data.habit.id}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    const dup = await request(app)
      .post(`/api/habits/${h.body.data.habit.id}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('HABIT_ALREADY_LOGGED');
  });
});

describe('DELETE /api/habits/:id/log/last — undo', () => {
  it('refunds XP and coins within the 60s window', async () => {
    const u = await makeUser();
    const h = await request(app)
      .post('/api/habits')
      .set(authHeader(u))
      .send({ name: 'Stretch', goal_type: 'daily', difficulty: 'easy', target_value: 1 });

    const log = await request(app)
      .post(`/api/habits/${h.body.data.habit.id}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    const xpEarned = log.body.data.habitCompletion.xpEarned;
    expect(xpEarned).toBeGreaterThan(0);

    // Snapshot XP at peak (after log + any badge bonus payouts).
    const peak = await request(app).get('/api/users/me').set(authHeader(u));
    const xpPeak = peak.body.data.user.xp;

    const undo = await request(app)
      .delete(`/api/habits/${h.body.data.habit.id}/log/last`)
      .set(authHeader(u));

    expect(undo.status).toBe(200);
    expect(undo.body.data.refunded.xp).toBe(xpEarned);

    // After undo: the log's XP is subtracted. Any badge bonus XP from
    // newly-awarded badges stays — un-awarding badges is intentionally
    // out of scope for undo (see plan §1.10 / DELETE /:id/log/last).
    const me = await request(app).get('/api/users/me').set(authHeader(u));
    expect(me.body.data.user.xp).toBe(xpPeak - xpEarned);
  });
});

describe('PUT /api/habits/:id — update + ownership', () => {
  it('lets the owner update; rejects others with 404', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const h = await request(app)
      .post('/api/habits')
      .set(authHeader(owner))
      .send({ name: 'Run', goal_type: 'daily', difficulty: 'medium', target_value: 1 });

    const id = h.body.data.habit.id;

    const updated = await request(app)
      .put(`/api/habits/${id}`)
      .set(authHeader(owner))
      .send({ name: 'Sprint' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.habit.name).toBe('Sprint');

    const intrusion = await request(app)
      .put(`/api/habits/${id}`)
      .set(authHeader(stranger))
      .send({ name: 'Owned' });
    expect(intrusion.status).toBe(404);
  });
});
