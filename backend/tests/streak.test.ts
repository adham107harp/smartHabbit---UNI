import request from 'supertest';
import { app, cleanDb, ensureMigrated, disconnect, makeUser, authHeader } from './_helpers/api';
import { db } from '../src/config/database';

beforeAll(async () => { await ensureMigrated(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await disconnect(); });

async function createHabit(u: { token: string; id: string }) {
  const r = await request(app)
    .post('/api/habits')
    .set({ Authorization: `Bearer ${u.token}` })
    .send({ name: 'Streak Test', goal_type: 'daily', difficulty: 'easy', target_value: 1 });
  return r.body.data.habit.id;
}

describe('Streak math', () => {
  it('starts at 1 on the first ever log', async () => {
    const u = await makeUser();
    const hid = await createHabit(u);

    const log = await request(app)
      .post(`/api/habits/${hid}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(log.body.data.streak.newStreak).toBe(1);
  });

  it('increments when yesterday is logged', async () => {
    const u = await makeUser();
    const hid = await createHabit(u);

    // Pretend the user logged yesterday + had a 5-day streak going.
    await db.query(
      `INSERT INTO habit_logs (habit_id, user_id, logged_date, value, xp_earned, coins_earned)
       VALUES ($1, $2, CURRENT_DATE - 1, 1, 10, 1)`,
      [hid, u.id]
    );
    await db.query(
      'UPDATE users SET current_streak = 5, max_streak = 5 WHERE id = $1',
      [u.id]
    );

    const log = await request(app)
      .post(`/api/habits/${hid}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(log.body.data.streak.newStreak).toBe(6);
    expect(log.body.data.streak.streakBroken).toBe(false);
  });

  it('resets to 1 when the user missed a day with no shield', async () => {
    const u = await makeUser();
    const hid = await createHabit(u);

    // Last log was 5 days ago; current_streak = 5; no shields.
    await db.query(
      `INSERT INTO habit_logs (habit_id, user_id, logged_date, value, xp_earned, coins_earned)
       VALUES ($1, $2, CURRENT_DATE - 5, 1, 10, 1)`,
      [hid, u.id]
    );
    await db.query(
      'UPDATE users SET current_streak = 5, max_streak = 5, streak_shields_count = 0 WHERE id = $1',
      [u.id]
    );

    const log = await request(app)
      .post(`/api/habits/${hid}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(log.body.data.streak.newStreak).toBe(1);
    expect(log.body.data.streak.streakBroken).toBe(true);
    expect(log.body.data.streak.shieldUsed).toBe(false);
  });

  it('consumes a shield instead of resetting when one is available', async () => {
    const u = await makeUser();
    const hid = await createHabit(u);

    await db.query(
      `INSERT INTO habit_logs (habit_id, user_id, logged_date, value, xp_earned, coins_earned)
       VALUES ($1, $2, CURRENT_DATE - 5, 1, 10, 1)`,
      [hid, u.id]
    );
    await db.query(
      'UPDATE users SET current_streak = 5, max_streak = 5, streak_shields_count = 1 WHERE id = $1',
      [u.id]
    );

    const log = await request(app)
      .post(`/api/habits/${hid}/log`)
      .set(authHeader(u))
      .send({ value: 1 });

    expect(log.body.data.streak.newStreak).toBe(6);
    expect(log.body.data.streak.shieldUsed).toBe(true);

    // Shield should be gone now
    const after = await db.queryOne(
      'SELECT streak_shields_count FROM users WHERE id = $1',
      [u.id]
    );
    expect(after.streak_shields_count).toBe(0);
  });
});
