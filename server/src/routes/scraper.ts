import { Router, Request, Response } from "express";
import {
  scrapeAndSeed,
  getScrapeJobs,
  getScrapeJobResult,
  flushCache,
} from "../services/scraperService";

const router = Router();

// POST /api/scraper/start
router.post("/start", async (req: Request, res: Response) => {
  const { source = "all", city = "Mumbai", pages = 2, autoSeed = true } = req.body;

  const VALID_SOURCES = ["99acres", "magicbricks", "all"];
  if (!VALID_SOURCES.includes(source)) {
    res.status(400).json({ error: `source must be one of: ${VALID_SOURCES.join(", ")}` });
    return;
  }
  if (pages < 1 || pages > 10) {
    res.status(400).json({ error: "pages must be between 1 and 10" });
    return;
  }

  try {
    const job = await scrapeAndSeed({ source, city, pages, autoSeed });
    res.status(202).json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scraper/jobs
router.get("/jobs", async (_req: Request, res: Response) => {
  try {
    res.json(await getScrapeJobs());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scraper/jobs/:jobId
router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    res.json(await getScrapeJobResult(req.params.jobId));
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/scraper/flush-cache  — instantly show newly seeded properties
router.post("/flush-cache", async (_req: Request, res: Response) => {
  try {
    const count = await flushCache();
    res.json({ message: `Flushed ${count} cache keys — refresh your browser` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
