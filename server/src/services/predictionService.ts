import { prisma } from "../lib/prisma";
import { cacheGet, cacheSet } from "../lib/redis";

// ─── Config ───────────────────────────────────────────────────────────────────

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_TIMEOUT_MS = 8000;

interface MlPredictionResponse {
  base_price: number;
  forecast: ForecastPoint[];
  annual_rate_pct?: number;
}

interface MlBulkPrediction {
  property_id: string;
  current_price: number;
  forecast_10y: number;
  appreciation_10y_pct: number;
  annual_rate_pct: number;
  forecast_curve?: ForecastPoint[];
  error?: string;
}

interface MlBulkResponse {
  predictions: MlBulkPrediction[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  year: number;
  price: number;
  appreciation_pct: number;
}

export interface PredictionResult {
  currentPrice: number;
  predictedPrice: number;
  confidenceLow: number;
  confidenceHigh: number;
  appreciationRate: number;
  priceIncrease: number;
  percentageIncrease: string;
  forecastCurve: ForecastPoint[];
  chartData: { year: number; predictedPrice: number }[];
  predictionSource: "ml" | "compound_rate";
}

export interface BulkPredictionResult {
  property_id: string;
  current_price: number;
  forecast_10y: number;
  appreciation_10y_pct: number;
  annual_rate_pct: number;
  forecast_curve: ForecastPoint[];
  confidence_low: number;
  confidence_high: number;
  error?: string;
}

// ─── ML Service Health ────────────────────────────────────────────────────────

let mlServiceAvailable: boolean | null = null;
let lastHealthCheck = 0;

async function checkMlHealth(): Promise<boolean> {
  const now = Date.now();
  if (mlServiceAvailable !== null && now - lastHealthCheck < 30_000) {
    return mlServiceAvailable;
  }
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    mlServiceAvailable = res.ok;
  } catch {
    mlServiceAvailable = false;
  }
  lastHealthCheck = Date.now();
  return mlServiceAvailable;
}

// ─── Fallback: compound rate (used when ML service is unavailable) ─────────────

const CITY_RATES: Record<string, number> = {
  Mumbai: 6.8, Delhi: 5.9, "New Delhi": 5.9, Bangalore: 7.2,
  Hyderabad: 8.1, Chennai: 5.4, Pune: 6.5, Kolkata: 4.8,
  Ahmedabad: 5.7, Noida: 6.1, Gurugram: 6.9, "Navi Mumbai": 6.2,
  Thane: 6.0, Goa: 7.8,
};

function compoundForecast(
  basePrice: number,
  appreciationRate: number,
  horizonYears: number
): PredictionResult {
  const rate = appreciationRate / 100;
  const forecastCurve: ForecastPoint[] = Array.from({ length: 11 }, (_, i) => ({
    year: i,
    price: Math.round(basePrice * (1 + rate) ** i),
    appreciation_pct: +((((1 + rate) ** i - 1) * 100).toFixed(1)),
  }));

  const atYear = forecastCurve[horizonYears] ?? forecastCurve[forecastCurve.length - 1];
  const predictedPrice = atYear.price;

  return {
    currentPrice: basePrice,
    predictedPrice,
    confidenceLow: Math.round(basePrice * 0.88),
    confidenceHigh: Math.round(basePrice * 1.12),
    appreciationRate,
    priceIncrease: predictedPrice - basePrice,
    percentageIncrease: atYear.appreciation_pct.toFixed(1),
    forecastCurve,
    chartData: forecastCurve.map((f) => ({
      year: f.year,
      predictedPrice: f.price,
    })),
    predictionSource: "compound_rate",
  };
}

// ─── Single Property Prediction ───────────────────────────────────────────────

export async function getPrediction(
  propertyId: string,
  years: number
): Promise<PredictionResult> {
  const cacheKey = `prediction_v2:${propertyId}:${years}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch property from DB (need features for ML model)
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    const err = new Error("Property not found") as any;
    err.statusCode = 404;
    throw err;
  }

  const mlAvailable = await checkMlHealth();

  let result: PredictionResult;

  if (mlAvailable) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), ML_TIMEOUT_MS);

      const response = await fetch(`${ML_SERVICE_URL}/predict/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          id: property.id,
          city: property.city,
          sqft: property.sqft,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          yearBuilt: property.yearBuilt,
          propertyType: property.propertyType,
          floor_number: 3,
          total_floors: 10,
          amenities_score: 5.0,
          horizon_years: Math.max(years, 10), // always fetch 10y, slice below
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`ML service error: ${response.status}`);

      const data = (await response.json()) as MlPredictionResponse;

      const forecastCurve: ForecastPoint[] = [
        { year: 0, price: data.base_price, appreciation_pct: 0 },
        ...data.forecast,
      ];

      const atYear =
        forecastCurve.find((f) => f.year === years) ??
        forecastCurve[forecastCurve.length - 1];

      result = {
        currentPrice: data.base_price,
        predictedPrice: atYear.price,
        confidenceLow: Math.round(data.base_price * 0.88),
        confidenceHigh: Math.round(data.base_price * 1.12),
        appreciationRate: data.annual_rate_pct ?? Number(property.appreciationRate),
        priceIncrease: atYear.price - data.base_price,
        percentageIncrease: atYear.appreciation_pct.toFixed(1),
        forecastCurve,
        chartData: forecastCurve.map((f) => ({
          year: f.year,
          predictedPrice: f.price,
        })),
        predictionSource: "ml",
      };
    } catch (err) {
      console.warn("[predictionService] ML call failed, using fallback:", err);
      result = compoundForecast(
        Number(property.currentPrice),
        CITY_RATES[property.city] ?? property.appreciationRate,
        years
      );
    }
  } else {
    result = compoundForecast(
      Number(property.currentPrice),
      CITY_RATES[property.city] ?? property.appreciationRate,
      years
    );
  }

  // Cache: 1 hour for ML results, 15 min for fallback
  const ttl = result.predictionSource === "ml" ? 3600 : 900;
  await cacheSet(cacheKey, JSON.stringify(result), ttl);

  return result;
}

// ─── Bulk Prediction (for page preload) ───────────────────────────────────────

export async function getBulkPredictions(
  propertyIds: string[]
): Promise<BulkPredictionResult[]> {
  if (propertyIds.length === 0) return [];

  // Split into cached and uncached
  const results: Map<string, BulkPredictionResult> = new Map();
  const uncachedIds: string[] = [];

  await Promise.all(
    propertyIds.map(async (id) => {
      const cached = await cacheGet(`bulk_prediction_v2:${id}`);
      if (cached) {
        results.set(id, JSON.parse(cached));
      } else {
        uncachedIds.push(id);
      }
    })
  );

  if (uncachedIds.length === 0) return propertyIds.map((id) => results.get(id)!);

  // Fetch properties from DB
  const properties = await prisma.property.findMany({
    where: { id: { in: uncachedIds } },
  });

  const mlAvailable = await checkMlHealth();

  if (mlAvailable) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), ML_TIMEOUT_MS * 2);

      const response = await fetch(`${ML_SERVICE_URL}/predict/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify(
          properties.map((p) => ({
            id: p.id,
            city: p.city,
            sqft: p.sqft,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            yearBuilt: p.yearBuilt,
            propertyType: p.propertyType,
            floor_number: 3,
            total_floors: 10,
            amenities_score: 5.0,
          }))
        ),
      });

      clearTimeout(timeout);

      if (response.ok) {
          const { predictions } = (await response.json()) as MlBulkResponse;
        for (const pred of predictions) {
          if (pred.error) continue;

          const bulkResult: BulkPredictionResult = {
            property_id: pred.property_id,
            current_price: pred.current_price,
            forecast_10y: pred.forecast_10y,
            appreciation_10y_pct: pred.appreciation_10y_pct,
            annual_rate_pct: pred.annual_rate_pct,
            forecast_curve: [
              { year: 0, price: pred.current_price, appreciation_pct: 0 },
              ...(pred.forecast_curve ?? []),
            ],
            confidence_low: Math.round(pred.current_price * 0.88),
            confidence_high: Math.round(pred.current_price * 1.12),
          };

          results.set(pred.property_id, bulkResult);
          await cacheSet(
            `bulk_prediction_v2:${pred.property_id}`,
            JSON.stringify(bulkResult),
            3600
          );
        }
      }
    } catch (err) {
      console.warn("[predictionService] Bulk ML call failed, using fallback:", err);
    }
  }

  // Fill any missing with compound fallback
  for (const p of properties) {
    if (!results.has(p.id)) {
      const rate = CITY_RATES[p.city] ?? p.appreciationRate;
      const rateDecimal = rate / 100;
      const currentPrice = Number(p.currentPrice);
      const forecastCurve: ForecastPoint[] = Array.from({ length: 11 }, (_, i) => ({
        year: i,
        price: Math.round(currentPrice * (1 + rateDecimal) ** i),
        appreciation_pct: +((((1 + rateDecimal) ** i - 1) * 100).toFixed(1)),
      }));

      const fallback: BulkPredictionResult = {
        property_id: p.id,
        current_price: currentPrice,
        forecast_10y: forecastCurve[10].price,
        appreciation_10y_pct: forecastCurve[10].appreciation_pct,
        annual_rate_pct: rate,
        forecast_curve: forecastCurve,
        confidence_low: Math.round(currentPrice * 0.88),
        confidence_high: Math.round(currentPrice * 1.12),
      };

      results.set(p.id, fallback);
      await cacheSet(
        `bulk_prediction_v2:${p.id}`,
        JSON.stringify(fallback),
        900
      );
    }
  }

  return propertyIds
    .map((id) => results.get(id))
    .filter(Boolean) as BulkPredictionResult[];
}

// ─── Direct forecast from property features (used by frontend hook) ────────────
// This endpoint accepts full property features so the hook can bypass DB lookups.

export async function getForecastFromFeatures(
  propertyData: {
    id: string;
    city: string;
    sqft: number;
    bedrooms: number;
    bathrooms: number;
    yearBuilt: number;
    propertyType: string;
    floor_number?: number;
    total_floors?: number;
    amenities_score?: number;
    horizon_years?: number;
  }
): Promise<{
  property_id: string;
  base_price: number;
  forecast: ForecastPoint[];
  annual_rate_pct: number;
  model: string;
}> {
  const cacheKey = `forecast_features:${propertyData.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const mlAvailable = await checkMlHealth();

  if (mlAvailable) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), ML_TIMEOUT_MS);
      const response = await fetch(`${ML_SERVICE_URL}/predict/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ ...propertyData, horizon_years: 10 }),
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = (await response.json()) as {
          property_id: string;
          base_price: number;
          forecast: ForecastPoint[];
          annual_rate_pct: number;
          model: string;
        };
        await cacheSet(cacheKey, JSON.stringify(data), 3600);
        return data;
      }
    } catch {
      // fall through to compound rate
    }
  }

  // Compound fallback
  const rate = CITY_RATES[propertyData.city] ?? 5.5;
  const rateDecimal = rate / 100;
  // We don't have a currentPrice in features — use city rate as a proxy
  // The hook already has the currentPrice from property data; we just supply the curve shape
  const basePrice = 1_000_000; // placeholder; hook overrides with its own currentPrice if needed
  const forecast: ForecastPoint[] = Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    price: Math.round(basePrice * (1 + rateDecimal) ** (i + 1)),
    appreciation_pct: +((((1 + rateDecimal) ** (i + 1) - 1) * 100).toFixed(1)),
  }));

  return {
    property_id: propertyData.id,
    base_price: basePrice,
    forecast,
    annual_rate_pct: rate,
    model: "compound_rate",
  };
}
