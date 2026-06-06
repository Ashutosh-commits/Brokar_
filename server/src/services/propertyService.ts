import { prisma } from "../lib/prisma";
import { cacheGet, cacheSet } from "../lib/redis";

export interface PropertyFilters {
  city?: string;
  type?: string;
  bhk?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  sort?: "price-asc" | "price-desc" | "appreciation";
  page?: number;
  limit?: number;
}

// ─── Get all properties with filters ─────────────────────────────────────────

export async function getProperties(filters: PropertyFilters) {
  const {
    city,
    type,
    bhk,
    search,
    minPrice,
    maxPrice,
    minBeds,
    minBaths,
    sort = "price-asc",
    page = 1,
    limit = 12,
  } = filters;

  // Cache key from filters
  const cacheKey = `properties:${JSON.stringify(filters)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  // Build where clause
  const where: any = { isActive: true };

  if (city && city !== "all") where.city = city;
  if (type && type !== "all") where.propertyType = type;
  if (bhk && bhk !== "all") where.bhkType = bhk;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }

  if (minPrice || maxPrice) {
    where.currentPrice = {};
    if (minPrice) where.currentPrice.gte = minPrice;
    if (maxPrice) where.currentPrice.lte = maxPrice;
  }
  if (minBeds) where.bedrooms = { gte: minBeds };
  if (minBaths) where.bathrooms = { gte: minBaths };

  // Sort
  const orderBy: any =
    sort === "price-desc"
      ? { currentPrice: "desc" }
      : sort === "appreciation"
      ? { appreciationRate: "desc" }
      : { currentPrice: "asc" };

  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, orderBy, skip, take: limit }),
    prisma.property.count({ where }),
  ]);

  // Normalize BigInt fields (Prisma BigInt -> JS BigInt) to numbers for JSON
  const normalized = properties.map((p: any) => ({
    ...p,
    currentPrice:
      typeof p.currentPrice === "bigint"
        ? Number(p.currentPrice)
        : p.currentPrice,
  }));

  const result = {
    data: normalized,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };

  // Cache for 5 minutes
  await cacheSet(cacheKey, JSON.stringify(result), 300);

  return result;
}

// ─── Get single property ──────────────────────────────────────────────────────

export async function getPropertyById(id: string) {
  const cacheKey = `property:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const property = await prisma.property.findUnique({ where: { id } });

  if (!property) {
    const err = new Error("Property not found") as any;
    err.statusCode = 404;
    throw err;
  }

  // Normalize BigInt before caching/returning
  const normalizedProperty = {
    ...property,
    currentPrice:
      property && typeof (property as any).currentPrice === "bigint"
        ? Number((property as any).currentPrice)
        : (property as any).currentPrice,
  };

  await cacheSet(cacheKey, JSON.stringify(normalizedProperty), 600);
  return normalizedProperty;
}

// ─── Get unique cities ────────────────────────────────────────────────────────

export async function getCities(): Promise<string[]> {
  const cacheKey = "properties:cities";
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = await prisma.property.findMany({
    where: { isActive: true },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  const cities = results.map((r) => r.city);
  await cacheSet(cacheKey, JSON.stringify(cities), 3600);
  return cities;
}
