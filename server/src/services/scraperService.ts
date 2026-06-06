import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || "http://localhost:8001";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 1000;

const localJobs: Map<string, ScrapeJobState> = new Map();

export interface ScrapeJobState {
  jobId: string;
  status: "queued" | "running" | "seeding" | "done" | "error";
  source: string;
  city: string;
  pages: number;
  startedAt: string;
  finishedAt?: string;
  scrapedCount: number;
  seededCount: number;
  error?: string;
}

// ─── Flush all property-related Redis cache keys ──────────────────────────────
async function flushPropertyCache() {
  if (!redis) return;
  try {
    // Delete all keys matching "properties:*" pattern
    const keys = await redis.keys("properties:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[scraperService] Flushed ${keys.length} Redis cache keys`);
    }
  } catch (err) {
    console.warn("[scraperService] Cache flush failed (non-fatal):", err);
  }
}

// ─── Start a scrape job ────────────────────────────────────────────────────────
export async function scrapeAndSeed(params: {
  source: string;
  city: string;
  pages: number;
  autoSeed: boolean;
}): Promise<ScrapeJobState> {
  const { source, city, pages, autoSeed } = params;

  const response = await fetch(`${SCRAPER_URL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, city, pages }),
  });

  if (!response.ok) {
    const err = new Error(`Scraper service error: ${response.status}`) as any;
    err.statusCode = 502;
    throw err;
  }

  const job = (await response.json()) as { job_id: string };
  const jobId: string = job.job_id;

  const state: ScrapeJobState = {
    jobId,
    status: "queued",
    source,
    city,
    pages,
    startedAt: new Date().toISOString(),
    scrapedCount: 0,
    seededCount: 0,
  };

  localJobs.set(jobId, state);

  if (autoSeed) {
    pollAndSeed(jobId).catch((err) => {
      const s = localJobs.get(jobId);
      if (s) { s.status = "error"; s.error = err.message; }
    });
  } else {
    pollUntilDone(jobId).catch(() => {});
  }

  return state;
}

// ─── Poll until Python job finishes, then seed DB + flush cache ───────────────
async function pollAndSeed(jobId: string) {
  await pollUntilDone(jobId);

  const state = localJobs.get(jobId);
  if (!state || state.status === "error") return;

  const res = await fetch(`${SCRAPER_URL}/scrape/${jobId}/results`);
  if (!res.ok) {
    state.status = "error";
    state.error = `Failed to fetch results: ${res.status}`;
    return;
  }

  const { properties } = (await res.json()) as { properties: any[] };
  state.scrapedCount = properties.length;
  state.status = "seeding";

  let seeded = 0;
  const BATCH = 50;

  for (let i = 0; i < properties.length; i += BATCH) {
    const batch = properties.slice(i, i + BATCH).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      city: p.city,
      location: p.location,
      propertyType: p.propertyType,
      bhkType: p.bhkType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      yearBuilt: p.yearBuilt,
      currentPrice: p.currentPrice,
      appreciationRate: p.appreciationRate,
      imageUrl: p.imageUrl,
      images: p.images || [],
      sourceUrl: p.sourceUrl || null,
      source: p.source || null,
      isActive: true,
    }));

    try {
      const result = await prisma.property.createMany({
        data: batch,
        skipDuplicates: true,
      });
      seeded += result.count;
    } catch (err) {
      console.error(`[scraperService] Batch error:`, err);
    }
  }

  state.seededCount = seeded;
  state.status = "done";
  state.finishedAt = new Date().toISOString();

  // ── Flush Redis so website shows new properties immediately ──────────────
  await flushPropertyCache();

  console.log(
    `[scraperService] Job ${jobId} done: scraped=${state.scrapedCount} seeded=${seeded} — cache flushed`
  );
}

async function pollUntilDone(jobId: string) {
  const state = localJobs.get(jobId)!;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const res = await fetch(`${SCRAPER_URL}/scrape/${jobId}`);
      if (!res.ok) continue;

      const job = (await res.json()) as {
        count?: number;
        status?: "queued" | "running" | "seeding" | "done" | "error";
        error?: string;
      };
      state.scrapedCount = job.count ?? 0;

      if (job.status === "done") {
        state.status = "seeding";
        return;
      }
      if (job.status === "error") {
        state.status = "error";
        state.error = job.error || "Scraper failed";
        state.finishedAt = new Date().toISOString();
        return;
      }

      if (job.status) {
        state.status = job.status;
      }
    } catch {
      // keep polling
    }
  }

  state.status = "error";
  state.error = "Polling timed out";
  state.finishedAt = new Date().toISOString();
}

export async function getScrapeJobs(): Promise<ScrapeJobState[]> {
  return Array.from(localJobs.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function getScrapeJobResult(jobId: string): Promise<ScrapeJobState> {
  const state = localJobs.get(jobId);
  if (!state) {
    const err = new Error("Job not found") as any;
    err.statusCode = 404;
    throw err;
  }
  return state;
}

// ─── Manual cache flush (called from route if needed) ─────────────────────────
export async function flushCache(): Promise<number> {
  if (!redis) return 0;
  const keys = await redis.keys("properties:*");
  if (keys.length > 0) await redis.del(...keys);
  return keys.length;
}
