import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { PrismaClient } from "@prisma/client";

import authRoutes from "./src/routes/auth";
import propertyRoutes from "./src/routes/properties";
import userRoutes from "./src/routes/users";
import chatRoutes from "./src/routes/chat";
import predictionRoutes from "./src/routes/predictions";
import scraperRoutes from "./src/routes/scraper";
import { errorHandler } from "./src/middleware/errorHandler";

const prisma = new PrismaClient();
const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((o) => o.trim()) : []),
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
];
const uniqueOrigins = Array.from(new Set(allowedOrigins.filter(Boolean)));

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (uniqueOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Global rate limit ────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
const envRateLimitMax = Number(process.env.RATE_LIMIT_MAX);
const rateLimitMax = Number.isInteger(envRateLimitMax) && envRateLimitMax > 0
  ? envRateLimitMax
  : isProduction
  ? 200
  : 1000;
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Please try again later." });
    },
  })
);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/scraper", scraperRoutes);


// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Auto-seed: runs once on startup if the properties table is empty ─────────
async function autoSeedIfEmpty() {
  try {
    const count = await prisma.property.count();
    if (count > 0) {
      console.log(`  ✓ Database already has ${count} properties — skipping seed`);
      return;
    }

    console.log("  ⚡ Database is empty — seeding properties automatically...");

    // Dynamically import seed data so this file stays clean
    const { propertySeedData } = await import("./prisma/mockProperties");

    function toInt(v: unknown, fb = 0) {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fb;
    }
    function toFloat(v: unknown, fb = 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : fb;
    }

    const normalized = (propertySeedData as any[]).map((p, i) => ({
      id: String(p?.id ?? `property-${i + 1}`),
      title: String(p?.title ?? "Untitled Property"),
      description: String(p?.description ?? ""),
      city: String(p?.city ?? ""),
      location: String(p?.location ?? ""),
      propertyType: String(p?.propertyType ?? "apartment").toLowerCase(),
      bhkType: String(p?.bhkType ?? ""),
      bedrooms: toInt(p?.bedrooms),
      bathrooms: toInt(p?.bathrooms),
      sqft: toInt(p?.sqft),
      yearBuilt: toInt(p?.yearBuilt, 2000),
      currentPrice: toInt(p?.currentPrice),
      appreciationRate: toFloat(p?.appreciationRate),
      imageUrl: String(p?.imageUrl ?? ""),
      images: Array.isArray(p?.images) ? p.images.map(String) : [],
      isActive: true,
    }));

    const BATCH = 200;
    let seeded = 0;
    for (let i = 0; i < normalized.length; i += BATCH) {
      const result = await prisma.property.createMany({
        data: normalized.slice(i, i + BATCH),
        skipDuplicates: true,
      });
      seeded += result.count;
    }

    console.log(`  ✓ Auto-seeded ${seeded} properties successfully`);
  } catch (err) {
    // Non-fatal — server still starts, manual seed can be run later
    console.warn("  ⚠ Auto-seed failed (run npm run db:seed manually):", err);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`\nBROkar API running on http://localhost:${PORT}`);
  console.log("Checking database...");
  await autoSeedIfEmpty();
  console.log("Ready.\n");
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\nERROR: Port ${PORT} is already in use. Stop the other process or set PORT to a free port before restarting the API.`);
    process.exit(1);
  }
  throw error;
});
