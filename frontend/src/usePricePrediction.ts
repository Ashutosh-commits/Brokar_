/**
 * usePricePrediction — React hook for property price prediction
 *
 * Fetches ML-powered price forecasts from the Express backend, which
 * proxies to the Python prediction service (XGBoost + LSTM).
 * Falls back to city-rate compound estimates if the service is unavailable.
 *
 * Usage:
 *   const { currentPrice, predictedPrice, forecastCurve, loading } =
 *     usePricePrediction(property, sliderYears);
 *
 * Setup:
 *   VITE_API_URL=http://127.0.0.1:3001   ← your Express backend
 */

import { useState, useEffect, useCallback, useRef } from "react";

// Points at your Express backend — NOT the Python service directly.
// The Express backend proxies to Python and handles caching + auth.
const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) ||
  "http://127.0.0.1:3001";

const PREDICTIONS_ENDPOINT = `${API_BASE}/api/predictions`;

// ─── In-memory cache (full 10-year curve per property) ────────────────────────
const predictionCache: Record<string, PredictionResult> = {};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropertyInput {
  id: string;
  city: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  propertyType: string;
  currentPrice?: number;         // used as display fallback before API responds
  appreciationRate?: number;
  floor_number?: number;
  total_floors?: number;
  amenities_score?: number;
}

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
  forecastCurve: ForecastPoint[];  // year 0 (current) through year 10
  appreciationRate: number;        // annual %
  totalAppreciation: number;       // total % gain at selected horizon
  priceDelta: number;
  predictionSource: "ml" | "compound_rate" | "loading";
  loading: boolean;
  error: string | null;
}

// ─── Auth helper — attach JWT so Express middleware accepts the request ───────
function authHeaders(): HeadersInit {
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("accessToken") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── City appreciation rate fallback table ────────────────────────────────────
const CITY_RATES: Record<string, number> = {
  Mumbai: 6.8, Delhi: 5.9, "New Delhi": 5.9, Bangalore: 7.2,
  Hyderabad: 8.1, Chennai: 5.4, Pune: 6.5, Kolkata: 4.8,
  Ahmedabad: 5.7, Noida: 6.1, Gurugram: 6.9, "Navi Mumbai": 6.2,
  Thane: 6.0, Goa: 7.8,
};

function buildFallbackCurve(
  basePrice: number,
  city: string,
  manualRate?: number
): ForecastPoint[] {
  const rate = (manualRate ?? CITY_RATES[city] ?? 5.5) / 100;
  return Array.from({ length: 11 }, (_, i) => ({
    year: i,
    price: Math.round(basePrice * (1 + rate) ** i),
    appreciation_pct: +((((1 + rate) ** i - 1) * 100).toFixed(1)),
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePricePrediction(
  property: PropertyInput,
  horizonYears: number = 5
): PredictionResult {
  const basePrice = property.currentPrice ?? 0;

  const [result, setResult] = useState<PredictionResult>({
    currentPrice: basePrice,
    predictedPrice: basePrice,
    confidenceLow: 0,
    confidenceHigh: 0,
    forecastCurve: [],
    appreciationRate: CITY_RATES[property.city] ?? 5.5,
    totalAppreciation: 0,
    priceDelta: 0,
    predictionSource: "loading",
    loading: true,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchPrediction = useCallback(async () => {
    const cacheKey = property.id;

    // Serve from in-memory cache (avoids repeated API calls when slider moves)
    if (predictionCache[cacheKey]) {
      const cached = predictionCache[cacheKey];
      const atYear =
        cached.forecastCurve.find((f) => f.year === horizonYears) ??
        cached.forecastCurve[cached.forecastCurve.length - 1];
      setResult({
        ...cached,
        predictedPrice: atYear?.price ?? cached.currentPrice,
        totalAppreciation: atYear?.appreciation_pct ?? 0,
        priceDelta: (atYear?.price ?? cached.currentPrice) - cached.currentPrice,
        loading: false,
        error: null,
      });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${PREDICTIONS_ENDPOINT}/forecast`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({
          id: property.id,
          city: property.city,
          sqft: property.sqft,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          yearBuilt: property.yearBuilt,
          propertyType: property.propertyType,
          floor_number: property.floor_number ?? 3,
          total_floors: property.total_floors ?? 10,
          amenities_score: property.amenities_score ?? 5.0,
          horizon_years: 10, // always fetch full 10y; derived below for slider
        }),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();

      // data shape from Express (mirrors Python output):
      // { property_id, base_price, forecast: [{year, price, appreciation_pct}], annual_rate_pct, model }
      const resolvedBasePrice = data.base_price !== 1_000_000
        ? data.base_price
        : (basePrice || data.base_price);

      const forecastCurve: ForecastPoint[] = [
        { year: 0, price: resolvedBasePrice, appreciation_pct: 0 },
        ...(data.forecast as ForecastPoint[]).map((f) => ({
          ...f,
          price: resolvedBasePrice !== data.base_price
            ? Math.round(resolvedBasePrice * (f.price / data.base_price))
            : f.price,
        })),
      ];

      const atYear =
        forecastCurve.find((f) => f.year === horizonYears) ??
        forecastCurve[forecastCurve.length - 1];

      const full: PredictionResult = {
        currentPrice: resolvedBasePrice,
        predictedPrice: atYear.price,
        confidenceLow: Math.round(resolvedBasePrice * 0.88),
        confidenceHigh: Math.round(resolvedBasePrice * 1.12),
        forecastCurve,
        appreciationRate: data.annual_rate_pct ?? CITY_RATES[property.city] ?? 5.5,
        totalAppreciation: atYear.appreciation_pct,
        priceDelta: atYear.price - resolvedBasePrice,
        predictionSource: data.model === "compound_rate" ? "compound_rate" : "ml",
        loading: false,
        error: null,
      };

      predictionCache[cacheKey] = full;
      setResult(full);
    } catch (err: any) {
      if (err.name === "AbortError") return;

      // Silent fallback using currentPrice from property card data
      const fallbackCurve = buildFallbackCurve(
        basePrice,
        property.city,
        property.appreciationRate
      );
      const atYear = fallbackCurve[horizonYears] ?? fallbackCurve[fallbackCurve.length - 1];

      const fallback: PredictionResult = {
        currentPrice: basePrice,
        predictedPrice: atYear.price,
        confidenceLow: Math.round(basePrice * 0.88),
        confidenceHigh: Math.round(basePrice * 1.12),
        forecastCurve: fallbackCurve,
        appreciationRate: CITY_RATES[property.city] ?? property.appreciationRate ?? 5.5,
        totalAppreciation: atYear.appreciation_pct,
        priceDelta: atYear.price - basePrice,
        predictionSource: "compound_rate",
        loading: false,
        error: null,
      };

      predictionCache[cacheKey] = fallback;
      setResult(fallback);
    }
  }, [property.id, property.city, basePrice]);

  useEffect(() => {
    fetchPrediction();
    return () => abortRef.current?.abort();
  }, [fetchPrediction]);

  // When only horizonYears changes, re-derive from cached curve (no network call)
  useEffect(() => {
    if (result.forecastCurve.length === 0) return;
    const atYear =
      result.forecastCurve.find((f) => f.year === horizonYears) ??
      result.forecastCurve[result.forecastCurve.length - 1];
    setResult((prev) => ({
      ...prev,
      predictedPrice: atYear.price,
      totalAppreciation: atYear.appreciation_pct,
      priceDelta: atYear.price - prev.currentPrice,
    }));
  }, [horizonYears]);

  return result;
}

// ─── Bulk Preloader ───────────────────────────────────────────────────────────
// Call once per page to warm the in-memory cache for all visible cards.

export async function preloadPredictions(properties: PropertyInput[]): Promise<void> {
  const uncached = properties.filter((p) => !predictionCache[p.id]);
  if (uncached.length === 0) return;

  try {
    const response = await fetch(`${PREDICTIONS_ENDPOINT}/bulk`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(uncached.slice(0, 50).map((p) => ({ id: p.id }))),
    });
    if (!response.ok) return;

    const { predictions } = await response.json();

    for (const pred of predictions) {
      if (pred.error || !pred.property_id) continue;

      const basePrice = pred.current_price;
      const forecastCurve: ForecastPoint[] = pred.forecast_curve ?? [];

      predictionCache[pred.property_id] = {
        currentPrice: basePrice,
        predictedPrice: pred.forecast_10y,
        confidenceLow: pred.confidence_low ?? Math.round(basePrice * 0.88),
        confidenceHigh: pred.confidence_high ?? Math.round(basePrice * 1.12),
        forecastCurve,
        appreciationRate: pred.annual_rate_pct ?? 5.5,
        totalAppreciation: pred.appreciation_10y_pct ?? 0,
        priceDelta: pred.forecast_10y - basePrice,
        predictionSource: "ml",
        loading: false,
        error: null,
      };
    }
  } catch {
    // Silently fail — individual hooks fall back to city-rate estimates
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatINR(amount: number, short = false): string {
  if (!amount || isNaN(amount)) return "₹0";
  if (short) {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)} Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Returns the chart data array expected by Recharts / Chart.js */
export function toChartData(
  forecastCurve: ForecastPoint[]
): { year: number; predictedPrice: number }[] {
  return forecastCurve.map((f) => ({ year: f.year, predictedPrice: f.price }));
}
