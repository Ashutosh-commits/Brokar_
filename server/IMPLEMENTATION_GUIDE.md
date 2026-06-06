# BROkar Backend — Complete Implementation Guide

---

## Step 0 — Prerequisites

Install these before starting:
- Node.js 20+ → https://nodejs.org
- Docker Desktop → https://docker.com/products/docker-desktop (for PostgreSQL + Redis)
- Git (already installed on most systems)

---

## PART 1 — File Placement

Place every file exactly as shown below. The left column is the file name,
the right column is where it lives in your project.

### Server files (all new — create the `server/` folder at the root)

```
FILE                                    →  PLACE AT
─────────────────────────────────────────────────────────────────────────────
server/package.json                     →  server/package.json
server/tsconfig.json                    →  server/tsconfig.json
server/index.ts                         →  server/index.ts
server/.env                             →  server/.env
server/prisma/schema.prisma             →  server/prisma/schema.prisma
server/prisma/seed.ts                   →  server/prisma/seed.ts
server/src/lib/prisma.ts                →  server/src/lib/prisma.ts
server/src/lib/redis.ts                 →  server/src/lib/redis.ts
server/src/middleware/authenticate.ts   →  server/src/middleware/authenticate.ts
server/src/middleware/rateLimiter.ts    →  server/src/middleware/rateLimiter.ts
server/src/middleware/errorHandler.ts   →  server/src/middleware/errorHandler.ts
server/src/services/authService.ts      →  server/src/services/authService.ts
server/src/services/propertyService.ts  →  server/src/services/propertyService.ts
server/src/services/chatService.ts      →  server/src/services/chatService.ts
server/src/services/predictionService.ts→  server/src/services/predictionService.ts
server/src/routes/auth.ts               →  server/src/routes/auth.ts
server/src/routes/properties.ts         →  server/src/routes/properties.ts
server/src/routes/users.ts              →  server/src/routes/users.ts
server/src/routes/chat.ts               →  server/src/routes/chat.ts
server/src/routes/predictions.ts        →  server/src/routes/predictions.ts
```

### Root files (at the very top level of your project)

```
FILE                  →  PLACE AT
──────────────────────────────────────
docker-compose.yml    →  brokar/docker-compose.yml   (project root)
.gitignore            →  brokar/.gitignore            (project root, or merge into existing)
```

### Client files (modifications to your existing client/)

```
FILE                                         →  PLACE AT
──────────────────────────────────────────────────────────────────────
client/.env                                  →  client/.env
client/src/lib/api.ts                        →  client/src/lib/api.ts  (NEW file)
client/src/components/chat/ChatBot.tsx       →  REPLACE existing ChatBot.tsx
```

---

## PART 2 — Fill in Your .env Values

Open `server/.env` and fill in these 3 things:

### 1. DATABASE_URL
You have two options:

**Option A — Local (uses Docker):**
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/brokar"
```
This works out of the box once Docker is running.

**Option B — Free cloud database (no Docker needed):**
Go to https://neon.tech → Sign up free → Create a project called "brokar"
→ Copy the connection string → paste it as DATABASE_URL.
It looks like: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/brokar?sslmode=require

### 2. JWT secrets
Open your terminal and run this command twice to generate two random secrets:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste the first output as JWT_SECRET, the second as REFRESH_SECRET.

### 3. GROQ_API_KEY
Go to https://console.groq.com → sign in → API Keys → Create key
Paste it as GROQ_API_KEY.

---

## PART 3 — First-Time Setup Commands

Run these commands in order. Open a terminal in your project root.

### Step 1 — Start the database (if using Docker/local)
```bash
docker-compose up -d
```
This starts PostgreSQL on port 5432 and Redis on port 6379.
Skip this step if you are using Neon.tech cloud database.

### Step 2 — Install server dependencies
```bash
cd server
npm install
```

### Step 3 — Generate Prisma client and create tables
```bash
npx prisma generate
npx prisma db push
```
This reads your schema.prisma and creates all the tables in your database.

### Step 4 — Seed the database with properties
```bash
npm run db:seed
```
This inserts the 8 sample properties into your database.
After this you can delete any old client-side sample property file if it still exists.

### Step 5 — Start the backend server
```bash
npm run dev
```
You should see: "BROkar API running on http://localhost:3001"

### Step 6 — Install client dependencies (in a new terminal)
```bash
cd client
npm install axios
```

### Step 7 — Start the frontend
```bash
npm run dev
```

---

## PART 4 — Changes to Existing Client Files

### 4a. Update App.tsx — replace local sample data with API calls

Find these lines in App.tsx and make the following changes:

REMOVE this import at the top:
```typescript
// remove old local sample data imports
```

ADD these imports at the top:
```typescript
import { useState, useEffect } from "react";
import { api, saveTokens, clearTokens, isLoggedIn } from "./lib/api";
import { Property } from "./types/property";
```

REPLACE local sample-data filter/map logic with:
```typescript
const [properties, setProperties] = useState<Property[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const params: Record<string, any> = {};
  if (searchQuery)           params.search    = searchQuery;
  if (filterType !== "all")  params.type      = filterType;
  if (cityFilter !== "all")  params.city      = cityFilter;
  if (bhkFilter !== "all")   params.bhk       = bhkFilter;
  if (bedroomFilter !== "all")  params.minBeds  = bedroomFilter;
  if (bathroomFilter !== "all") params.minBaths = bathroomFilter;
  if (priceRange[0] !== 0)      params.minPrice = priceRange[0];
  if (priceRange[1] !== 2000000) params.maxPrice = priceRange[1];
  params.sort = sortBy;

  setIsLoading(true);
  api.get("/properties", { params })
    .then(({ data }) => setProperties(data.data))
    .catch(console.error)
    .finally(() => setIsLoading(false));
}, [searchQuery, filterType, cityFilter, bhkFilter,
    bedroomFilter, bathroomFilter, priceRange, sortBy]);
```

REPLACE handleLogin:
```typescript
const handleLogin = (accessToken: string, refreshToken: string) => {
  saveTokens(accessToken, refreshToken);
  setIsLoggedIn(true);
  setCurrentView("dashboard");
};
```

REPLACE handleLogout:
```typescript
const handleLogout = () => {
  api.post("/auth/logout").finally(() => {
    clearTokens();
    setIsLoggedIn(false);
    setCurrentView("landing");
    setFavoriteIds(new Set());
    setCompareIds(new Set());
  });
};
```

REPLACE useState for isLoggedIn:
```typescript
const [isLoggedIn, setIsLoggedIn] = useState(isLoggedIn());
```

UPDATE ChatBot usage to pass isLoggedIn prop:
```tsx
<ChatBot
  open={isChatOpen}
  onOpenChange={setIsChatOpen}
  isLoggedIn={isLoggedIn}
/>
```

### 4b. Update LoginSignup.tsx — call real API

Find the login/register submit handler and replace the fake login with:
```typescript
import { api, saveTokens } from "../../lib/api";

// In your submit handler:
try {
  const { data } = await api.post("/auth/login", { email, password });
  saveTokens(data.accessToken, data.refreshToken);
  onLogin(data.accessToken, data.refreshToken);
} catch (err: any) {
  setError(err.response?.data?.error || "Login failed");
}

// For register:
try {
  const { data } = await api.post("/auth/register", { email, password, name });
  saveTokens(data.accessToken, data.refreshToken);
  onLogin(data.accessToken, data.refreshToken);
} catch (err: any) {
  setError(err.response?.data?.error || "Registration failed");
}
```

### 4c. Update toggleFavorite — call real API

```typescript
const toggleFavorite = async (propertyId: string) => {
  if (!isLoggedIn) return;
  const isFav = favoriteIds.has(propertyId);

  // Optimistic update
  setFavoriteIds((prev) => {
    const next = new Set(prev);
    isFav ? next.delete(propertyId) : next.add(propertyId);
    return next;
  });

  try {
    if (isFav) {
      await api.delete(`/users/me/favorites/${propertyId}`);
    } else {
      await api.post(`/users/me/favorites/${propertyId}`);
    }
  } catch {
    // Revert optimistic update on error
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.add(propertyId) : next.delete(propertyId);
      return next;
    });
  }
};
```

---

## PART 5 — Verify Everything Works

Open these URLs in your browser after both servers are running:

1. http://localhost:3001/api/health
   → Should return: {"status":"ok","timestamp":"..."}

2. http://localhost:3001/api/properties
   → Should return a list of 8 properties

3. http://localhost:5173
   → Your app should load with real properties from the database

---

## PART 6 — Final Folder Structure

After completing all steps, your project should look like this:

```
brokar/
├── docker-compose.yml
├── .gitignore
│
├── client/
│   ├── .env                              ← VITE_API_URL
│   ├── src/
│   │   ├── App.tsx                       ← MODIFIED
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── lib/
│   │   │   ├── api.ts                    ← NEW
│   │   │   └── utils.ts
│   │   ├── components/
│   │   │   ├── ui/           (40 shadcn components)
│   │   │   ├── layout/
│   │   │   │   ├── LandingPage.tsx       ← MODIFIED (fixed imports)
│   │   │   │   ├── LoginSignup.tsx       ← MODIFIED (real API calls)
│   │   │   │   └── Header.tsx
│   │   │   ├── property/
│   │   │   │   ├── PropertyCard.tsx
│   │   │   │   └── PropertyComparison.tsx
│   │   │   ├── chat/
│   │   │   │   └── ChatBot.tsx           ← REPLACED
│   │   │   └── profile/
│   │   │       └── ProfileView.tsx
│   │   ├── hooks/
│   │   │   └── use-mobile.ts
│   │   ├── types/
│   │   │   └── property.ts
│   │   └── utils/
│   │       └── priceCalculator.ts
│   └── package.json
│
└── server/
    ├── .env                              ← FILL THIS IN
    ├── package.json
    ├── tsconfig.json
    ├── index.ts
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    └── src/
        ├── lib/
        │   ├── prisma.ts
        │   └── redis.ts
        ├── middleware/
        │   ├── authenticate.ts
        │   ├── rateLimiter.ts
        │   └── errorHandler.ts
        ├── services/
        │   ├── authService.ts
        │   ├── propertyService.ts
        │   ├── chatService.ts
        │   └── predictionService.ts
        └── routes/
            ├── auth.ts
            ├── properties.ts
            ├── users.ts
            ├── chat.ts
            └── predictions.ts
```
