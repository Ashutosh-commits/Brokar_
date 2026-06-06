import { Router, Request, Response } from "express";
import {
  getProperties,
  getPropertyById,
  getCities,
} from "../services/propertyService";

const router = Router();

// ─── GET /api/properties ──────────────────────────────────────────────────────
// Query params: city, type, bhk, search, minPrice, maxPrice,
//               minBeds, minBaths, sort, page, limit

router.get("/", async (req: Request, res: Response) => {
  try {
    const filters = {
      city: req.query.city as string,
      type: req.query.type as string,
      bhk: req.query.bhk as string,
      search: req.query.search as string,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      minBeds: req.query.minBeds ? Number(req.query.minBeds) : undefined,
      minBaths: req.query.minBaths ? Number(req.query.minBaths) : undefined,
      sort: req.query.sort as any,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 12,
    };

    const result = await getProperties(filters);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ─── GET /api/properties/cities ───────────────────────────────────────────────

router.get("/cities", async (_req: Request, res: Response) => {
  try {
    const cities = await getCities();
    res.json(cities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/properties/:id ──────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const property = await getPropertyById(req.params.id);
    res.json(property);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
