# BROkar — Deployment Guide

## Recommended free stack

| Service | Provider | Free tier |
|---|---|---|
| Frontend (React) | **Vercel** | Unlimited deploys, custom domain |
| API (Node.js) | **Railway** | $5/month credit (no card needed) |
| Database (Postgres) | **Neon** | 0.5 GB, 1 project |
| Cache (Redis) | **Upstash** | 10,000 req/day, 256 MB |
| ML service (Python) | **Railway** | Included in $5 credit |
| Scraper | ❌ Keep local | Chrome/Selenium can't run free |

You can host the entire app for free (or under $5/month for the API + ML).

---

## Step 1 — Set up external services (10 min)

### 1a. Neon (free Postgres)
1. Go to https://neon.tech → **Create account** → **Create project** → name it `brokar`
2. Copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Save it — this is your `DATABASE_URL`.

### 1b. Upstash (free Redis)
1. Go to https://upstash.com → **Create account** → **Create database** → region: closest to your users
2. Copy the **Redis URL** — it looks like:
   ```
   rediss://default:password@xxx.upstash.io:6379
   ```
3. Save it — this is your `REDIS_URL`.

### 1c. Groq (free AI)
1. Go to https://console.groq.com → **Create account** → **API Keys** → **Create API Key**
2. Save the key — this is your `GROQ_API_KEY`.

---

## Step 2 — Push code to GitHub (5 min)

```bash
cd brokar-output           # your project root
git init
git add .
git commit -m "initial commit"

# Create a repo at github.com (name it brokar), then:
git remote add origin https://github.com/YOUR_USERNAME/brokar.git
git push -u origin main
```

> ⚠️ Make sure `.env`, `server/.env`, and `scraper/.env` are listed in `.gitignore` before pushing.
> The `.gitignore` in this project already covers them.

---

## Step 3 — Deploy the API on Railway (10 min)

1. Go to https://railway.app → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo** → select your `brokar` repo
3. Railway detects Node.js automatically. Set the **Root directory** to `server/`.
4. Add these **Environment variables** in Railway's dashboard:

```
DATABASE_URL       = <your Neon connection string>
REDIS_URL          = <your Upstash Redis URL>
JWT_SECRET         = <run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
REFRESH_SECRET     = <same command, different output>
GROQ_API_KEY       = <your Groq key>
SCRAPER_API_KEY    = <any random string, e.g. openssl rand -hex 16>
NODE_ENV           = production
PORT               = 3001
CLIENT_URL         = https://YOUR-APP.vercel.app   ← fill in after Step 4
```

5. In **Settings → Build command**: `npm install && npm run build`
6. In **Settings → Start command**: `npx prisma db push && node dist/index.js`
7. Click **Deploy**. Railway gives you a URL like `https://brokar-api.up.railway.app`.
8. Test it: `curl https://brokar-api.up.railway.app/api/health` → should return `{"status":"ok"}`

---

## Step 4 — Deploy the frontend on Vercel (5 min)

1. Go to https://vercel.com → **Login with GitHub**
2. Click **Add New Project** → select your `brokar` repo
3. Vercel detects Vite automatically. Configure:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `build`
   - **Root directory**: `.` (leave as-is)
4. Add this **Environment variable**:
   ```
   VITE_API_URL = https://brokar-api.up.railway.app/api
   ```
5. Click **Deploy**. Vercel gives you a URL like `https://brokar.vercel.app`.
6. Go back to Railway → update `CLIENT_URL` to `https://brokar.vercel.app` → redeploy.

---

## Step 5 — Deploy the ML service on Railway (optional)

The ML service (`property_prediction_model.py`) handles price predictions.
You can deploy it alongside the API:

1. In Railway → **New Service** → **GitHub repo** → same `brokar` repo
2. Set **Root directory** to `.` (project root)
3. **Build command**: `pip install -r requirements.txt`
4. **Start command**: `python property_prediction_model.py serve`
5. Add `PORT=8000` as an environment variable.
6. Copy the service URL (e.g. `https://brokar-ml.up.railway.app`)
7. In the API service, add: `ML_SERVICE_URL=https://brokar-ml.up.railway.app`

---

## Working with a live project

### Making code changes

```bash
# 1. Make your changes locally
# 2. Test locally: npm run dev:all
# 3. Commit and push
git add .
git commit -m "describe what you changed"
git push
```

**Vercel** redeploys the frontend automatically on every push to `main`.  
**Railway** redeploys the API automatically on every push to `main`.

### Changing environment variables

- Vercel: Dashboard → Project → Settings → Environment Variables → edit → **Redeploy**
- Railway: Dashboard → Service → Variables → edit → Railway redeploys automatically

> ⚠️ `VITE_API_URL` is baked into the JS bundle at build time. If you change it,
> you must **redeploy** (not just restart) for it to take effect.

### Viewing live logs

**Railway**:
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway logs --service brokar-api
```

**Vercel**:
Go to Dashboard → Project → Deployments → click a deployment → **Functions** tab.

### Running database migrations

When you change `server/prisma/schema.prisma`:

```bash
# Locally (dev)
cd server
npx prisma db push       # applies schema to local DB

# Production (Railway)
# Railway runs `npx prisma db push` automatically on each deploy (see start command).
# For major changes, you may want to:
railway run --service brokar-api npx prisma db push
```

### Seeding the database

The API auto-seeds on first boot if the DB is empty. To re-seed manually:
```bash
railway run --service brokar-api npx tsx prisma/seed.ts
```

### Debugging production issues

1. **Frontend blank screen** → open browser DevTools → Console tab → look for red errors.
   Usually means `VITE_API_URL` points to wrong/unreachable API.

2. **API 502 / 503** → check Railway logs. Usually means:
   - Missing env variable
   - `prisma db push` failed (schema conflict)
   - Port mismatch (must be `PORT=3001`)

3. **CORS errors** → `CLIENT_URL` in Railway doesn't match the Vercel URL exactly.
   Make sure there's no trailing slash: `https://brokar.vercel.app` not `https://brokar.vercel.app/`

4. **Database connection failed** → Neon connection strings require `?sslmode=require` at the end.

### Rolling back a bad deploy

**Vercel**: Dashboard → Deployments → find last working deploy → **Promote to Production**  
**Railway**: Dashboard → Deployments → click a past deploy → **Rollback**

### Keeping costs at $0

- Railway free credit: $5/month. A Node.js API + Python ML service uses roughly $2-4/month.
- Neon free tier: 0.5 GB storage, auto-pauses after 5 min idle (resumes in ~1s on next request).
- Upstash free tier: 10,000 Redis requests/day. BROkar typically uses <1,000/day.
- Vercel free: unlimited for personal projects.

If you exceed Railway's credit, upgrade to Hobby ($5/month) or move heavy services to Fly.io.

---

## Local Docker setup (alternative to cloud)

If you want to self-host everything on a VPS (DigitalOcean, Hetzner, etc.):

```bash
# 1. Copy and fill in env file
cp .env.example .env
# edit .env with your values

# 2. Build and start all services
docker compose up -d --build

# Services will be available at:
#   Frontend:  http://localhost:3000
#   API:       http://localhost:3001
#   ML:        http://localhost:8000
#   Postgres:  localhost:5433
```

Generate secrets before deploying:
```bash
# DB password
openssl rand -hex 20

# JWT secrets (run twice, use different outputs)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Redis password
openssl rand -hex 20

# Scraper API key
openssl rand -hex 16
```
