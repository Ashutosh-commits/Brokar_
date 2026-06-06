// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

function toInt(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num));
}

function toFloat(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function normalizeProperty(p: any, index: number) {
  return {
    id: String(p?.id ?? `property-${index + 1}`),
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
  };
}

async function main() {
  const { propertySeedData } = await import("./mock" + "Properties");
  const normalized = propertySeedData.map(normalizeProperty);

  console.log(`Seeding ${normalized.length} properties...`);

  // Optional reset so reruns always represent the current source dataset.
  await prisma.property.deleteMany({});

  for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
    const batch = normalized.slice(i, i + BATCH_SIZE);
    await prisma.property.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(
      `Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, normalized.length)}/${normalized.length})`
    );
  }

  console.log(`Seed complete: ${normalized.length} properties available.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
