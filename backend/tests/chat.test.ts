import request from 'supertest';
import { app, cleanDb, ensureMigrated, disconnect, makeUser, authHeader } from './_helpers/api';
import { db } from '../src/config/database';

beforeAll(async () => { await ensureMigrated(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await disconnect(); });

async function makeFriends(aId: string, bId: string) {
  await db.query(
    `INSERT INTO friends (user_id, friend_id, status)
     VALUES ($1, $2, 'accepted')`,
    [aId, bId]
  );
}

describe('Chat REST + friendship gate', () => {
  it('rejects sending to a non-friend (400)', async () => {
    const a = await makeUser();
    const b = await makeUser();

    const res = await request(app)
      .post(`/api/chat/with/${b.id}`)
      .set(authHeader(a))
      .send({ body: 'hi' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/friend/i);
  });

  it('rejects sending to yourself (400)', async () => {
    const a = await makeUser();
    const res = await request(app)
      .post(`/api/chat/with/${a.id}`)
      .set(authHeader(a))
      .send({ body: 'lonely' });

    expect(res.status).toBe(400);
  });

  it('accepts a message between accepted friends', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeFriends(a.id, b.id);

    const res = await request(app)
      .post(`/api/chat/with/${b.id}`)
      .set(authHeader(a))
      .send({ body: 'hello there' });

    expect(res.status).toBe(201);
    expect(res.body.data.message.body).toBe('hello there');
    expect(res.body.data.message.sender_id).toBe(a.id);
    expect(res.body.data.message.receiver_id).toBe(b.id);
  });

  it('returns chronological history between the two users', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeFriends(a.id, b.id);

    await request(app).post(`/api/chat/with/${b.id}`).set(authHeader(a)).send({ body: 'one' });
    await request(app).post(`/api/chat/with/${a.id}`).set(authHeader(b)).send({ body: 'two' });
    await request(app).post(`/api/chat/with/${b.id}`).set(authHeader(a)).send({ body: 'three' });

    const res = await request(app).get(`/api/chat/with/${b.id}`).set(authHeader(a));
    expect(res.status).toBe(200);
    const bodies = res.body.data.messages.map((m: any) => m.body);
    expect(bodies).toEqual(['one', 'two', 'three']);
  });

  it('the friendship check accepts both edge orderings', async () => {
    const a = await makeUser();
    const b = await makeUser();
    // Friendship was stored as (b, a) — send still works
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted')`,
      [b.id, a.id]
    );

    const res = await request(app)
      .post(`/api/chat/with/${b.id}`)
      .set(authHeader(a))
      .send({ body: 'reverse-order friendship works' });

    expect(res.status).toBe(201);
  });
});
