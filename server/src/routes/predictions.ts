import { Router, Request, Response } from "express";
import {
  getPrediction,
  getBulkPredictions,
  getForecastFromFeatures,
} from "../services/predictionService";

const router = Router();

// ─── GET /api/predictions/:propertyId?years=5 ─────────────────────────────────
// Original endpoint — fetches property from DB by ID, returns full result.

router.get("/:propertyId", async (req: Request, res: Response) => {
  const years = req.query.years ? Number(req.query.years) : 5;

  if (isNaN(years) || years < 1 || years > 30) {
    res.status(400).json({ error: "Years must be between 1 and 30" });
    return;
  }

  try {
    const result = await getPrediction(req.params.propertyId, years);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ─── POST /api/predictions/forecast ──────────────────────────────────────────
// Used by the usePricePrediction hook — accepts full property features,
// proxies to the Python ML service, returns the same shape the hook expects.

router.post("/forecast", async (req: Request, res: Response) => {
  const {
    id,
    city,
    sqft,
    bedrooms,
    bathrooms,
    yearBuilt,
    propertyType,
    floor_number,
    total_floors,
    amenities_score,
    horizon_years,
  } = req.body;

  if (!id || !city || !sqft || !bedrooms || !bathrooms || !yearBuilt || !propertyType) {
    res.status(400).json({ error: "Missing required property fields" });
    return;
  }

  try {
    const result = await getForecastFromFeatures({
      id,
      city,
      sqft: Number(sqft),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      yearBuilt: Number(yearBuilt),
      propertyType,
      floor_number: floor_number ?? 3,
      total_floors: total_floors ?? 10,
      amenities_score: amenities_score ?? 5.0,
      horizon_years: horizon_years ?? 10,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/predictions/bulk ───────────────────────────────────────────────
// Used by preloadPredictions() in the hook — accepts list of property IDs,
// returns batch predictions cached per property.

router.post("/bulk", async (req: Request, res: Response) => {
  const body = req.body;

  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Body must be a non-empty array of property objects" });
    return;
  }

  // Accept either array of { id } objects or full property objects —
  // extract IDs and call the DB-backed bulk service.
  const propertyIds: string[] = body
    .map((item: any) => item.id)
    .filter(Boolean)
    .slice(0, 50);

  if (propertyIds.length === 0) {
    res.status(400).json({ error: "No valid property IDs found in request body" });
    return;
  }

  try {
    const predictions = await getBulkPredictions(propertyIds);
    res.json({ predictions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
