import request from 'supertest';
import { app, cleanDb, ensureMigrated, disconnect, makeUser, authHeader } from './_helpers/api';
import { db } from '../src/config/database';

beforeAll(async () => { await ensureMigrated(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await disconnect(); });

/**
 * Regression test for the v4 critical fix: notifications service used to
 * ignore user_id, so any authenticated user could mark/delete any other
 * user's notifications by guessing the UUID.
 */
describe('Notifications authorization (v4 fix)', () => {
  async function insertNotificationFor(userId: string): Promise<string> {
    const row = await db.queryOne(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Test', 'A test notification', 'general')
       RETURNING id`,
      [userId]
    );
    return row.id;
  }

  it('User B cannot mark User A\'s notification as read (404)', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const id = await insertNotificationFor(a.id);

    const res = await request(app)
      .put(`/api/notifications/${id}/read`)
      .set(authHeader(b));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOTIFICATION_NOT_FOUND');

    // Confirm A's notification is still unread
    const row = await db.queryOne('SELECT is_read FROM notifications WHERE id = $1', [id]);
    expect(row.is_read).toBe(false);
  });

  it('User B cannot delete User A\'s notification (404)', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const id = await insertNotificationFor(a.id);

    const res = await request(app)
      .delete(`/api/notifications/${id}`)
      .set(authHeader(b));

    expect(res.status).toBe(404);

    // Confirm it still exists
    const row = await db.queryOne('SELECT 1 FROM notifications WHERE id = $1', [id]);
    expect(row).toBeTruthy();
  });

  it('Owner can mark their own notification as read', async () => {
    const a = await makeUser();
    const id = await insertNotificationFor(a.id);

    const res = await request(app)
      .put(`/api/notifications/${id}/read`)
      .set(authHeader(a));

    expect(res.status).toBe(200);
    const row = await db.queryOne('SELECT is_read FROM notifications WHERE id = $1', [id]);
    expect(row.is_read).toBe(true);
  });

  it('Owner can delete their own notification', async () => {
    const a = await makeUser();
    const id = await insertNotificationFor(a.id);

    const res = await request(app)
      .delete(`/api/notifications/${id}`)
      .set(authHeader(a));

    expect(res.status).toBe(200);
    const row = await db.queryOne('SELECT 1 FROM notifications WHERE id = $1', [id]);
    expect(row).toBeNull();
  });
});

describe('GET /api/notifications', () => {
  it('only lists my own notifications', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'mine', 'm', 'general'),
              ($2, 'theirs', 't', 'general')`,
      [a.id, b.id]
    );

    const res = await request(app).get('/api/notifications').set(authHeader(a));
    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBe(1);
    expect(res.body.data.notifications[0].title).toBe('mine');
  });
});
