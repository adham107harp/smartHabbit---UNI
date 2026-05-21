# SmartHabbit — Deployment Guide

Two ways to run SmartHabbit:

1. **Local with Docker** — `docker compose up --build` and you're done.
2. **Free public deployment** — Neon (Postgres) + Render (backend) + Netlify (frontend). Takes about 20 minutes.

---

## 1) Local with Docker

Prereqs: Docker Desktop or `docker` + `docker compose` on Linux.

```bash
git clone <your repo>
cd "smartHabbit - UNI"
docker compose up --build
```

That brings up three containers:

| Container | Port | What it is |
|---|---|---|
| `smarthabbit-db`  | 5432 | PostgreSQL 16, data lives in the `pgdata` volume |
| `smarthabbit-api` | 3000 | Node + Express backend, runs migrations on first boot |
| `smarthabbit-web` | 5500 | nginx serving the static frontend; proxies `/api` and `/socket.io` to the backend |

Open **http://localhost:5500/index.html**, register an account, and you're in.

Seed the catalog data (badges, themes, frames, consumables, challenges) on first run:

```bash
docker compose exec backend npm run seed
docker compose exec backend npm run seed:badges
```

Useful one-offs:

```bash
docker compose exec backend npm run punish-now          # run the daily punishment sweep manually
docker compose exec backend npm run reset-test-users    # reset test passwords + regenerate USERS.md
docker compose exec db psql -U smarthabbit -d smarthabbit   # poke around in postgres
```

To stop and keep the data: `docker compose down`.
To **wipe the database** as well: `docker compose down -v`.

---

## 2) Free public deployment

The simplest free path is:

- **Database** → [Neon](https://neon.tech) (PostgreSQL, 500 MB free tier, no card)
- **Backend** → [Render](https://render.com) (free web service, sleeps after 15 min of inactivity)
- **Frontend** → [Netlify Drop](https://app.netlify.com/drop) or [Vercel](https://vercel.com) for static hosting

### Step 1 — Database on Neon

1. Sign up at neon.tech.
2. Create a project; pick a region close to where your users live.
3. From the dashboard, copy the **connection string**. It looks like:
   ```
   postgres://USER:PASS@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **Test the connection** from your machine:
   ```bash
   psql "postgres://USER:PASS@ep-…/neondb?sslmode=require" -c "SELECT NOW();"
   ```

### Step 2 — Backend on Render

1. Push this repo to GitHub if you haven't already.
2. On render.com → **New** → **Web Service** → connect your repo.
3. Configure:
   - **Root directory**: `backend`
   - **Runtime**: Node
   - **Build command**: `npm install && npx tsc`
   - **Start command**: `node dist/index.js`
   - **Plan**: Free
4. Add these **environment variables** (Render → Environment tab):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` _(Render gives you a port — let it set this automatically)_ |
   | `HOST` | `0.0.0.0` |
   | `DB_HOST` | _(host from Neon string, e.g. `ep-…aws.neon.tech`)_ |
   | `DB_PORT` | `5432` |
   | `DB_NAME` | `neondb` |
   | `DB_USER` | _(user from Neon)_ |
   | `DB_PASSWORD` | _(password from Neon)_ |
   | `DB_SSL` | `true` |
   | `JWT_SECRET` | _(random 64-char string — generate with `openssl rand -hex 32`)_ |
   | `JWT_EXPIRY` | `24h` |
   | `REFRESH_TOKEN_EXPIRY` | `7d` |
   | `CORS_ORIGIN` | _(your Netlify URL, e.g. `https://smarthabbit.netlify.app`)_ |
   | `RATE_LIMIT_MAX_REQUESTS` | `300` |

5. Deploy. The first build takes ~3 minutes. Migrations run automatically on first boot.
6. Once it's up, hit `https://YOUR-API.onrender.com/health` — you should see `{"status":"ok"}`.
7. Seed the catalog (Render → Shell tab, or one-time job):
   ```
   npm run seed
   npm run seed:badges
   ```

### Step 3 — Frontend on Netlify

1. **Edit `frontend/js/api.js`** — change the `BASE_URL` so it points at your Render URL. Set a `SMARTHABBIT_API_URL` script tag in `index.html` if you'd rather not edit the file:
   ```html
   <script>window.SMARTHABBIT_API_URL = 'https://YOUR-API.onrender.com';</script>
   <script src="js/api.js"></script>
   ```
2. Drag the `frontend/` folder onto **[Netlify Drop](https://app.netlify.com/drop)** — done in 30 seconds. Or connect the repo to Netlify and set the publish directory to `frontend/`.
3. Note your Netlify URL (e.g. `https://smarthabbit-xyz.netlify.app`).
4. **Back in Render** → update `CORS_ORIGIN` env var to include that URL, then "Manual Deploy" so the new value takes effect.

### Step 4 — Try it

Visit your Netlify URL → register a new account → log a habit. If anything blocks at the network layer, check the browser console for CORS errors and the Render logs for stack traces.

### Notes on the free tier

- **Render free** spins down after 15 minutes of inactivity. The first request after that takes ~30 seconds to wake the container. Users will see a brief loading spinner; not great, but free.
- **Neon free** has a 500 MB limit. For a class project that's plenty.
- **Socket.io** works out of the box on Render — nothing special to configure.
- **Habit reminders** only fire while a tab is open. Real push notifications need a service worker and a Web Push server; not part of v3.

---

## Known limitations

- The avatar uploads live on the backend container. On Render's free tier, the filesystem is **not persistent** between deploys. For a real production app you'd swap this for S3 or Cloudinary; for the university demo, restarting Render = your test users lose their uploaded photos.
- No CDN. Static assets are served straight from nginx (Docker) or Netlify (cloud).
- No email service. Forgot-password is wired up on the frontend but the backend silently no-ops.

---

## Commands reference

```bash
# locally without Docker
npm --prefix backend run dev
cd frontend && npx http-server -p 5500

# locally with Docker
docker compose up --build
docker compose exec backend npm run seed
docker compose exec backend npm run seed:badges

# user maintenance
docker compose exec backend npm run reset-test-users
docker compose exec backend npm run punish-now
```
