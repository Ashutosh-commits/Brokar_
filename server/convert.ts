import fs from "fs";
import path from "path";

// read your JSON file
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "convertedProperties.json"), "utf-8")
);

// format it properly
const formatted = data.map((p: any) => ({
  id: String(p.id),
  title: p.title || "",
  description: p.description || "",
  currentPrice: p.currentPrice || 0,
  location: p.location || "",
  city: p.city || "",
  bedrooms: p.bedrooms || 0,
  bathrooms: p.bathrooms || 0,
  sqft: p.sqft || 0,
  imageUrl: p.imageUrl || "",
  images: p.images || [],
  yearBuilt: p.yearBuilt || 2000,
  propertyType: p.propertyType?.toLowerCase() || "apartment",
  bhkType: p.bhkType || "",
  appreciationRate: p.appreciationRate || 0,
}));

// convert to TS file format
const output = `
import { Property } from "../types/property";

export const convertedProperties: Property[] = ${JSON.stringify(formatted, null, 2)};
`;

// write to file
fs.writeFileSync(
  path.join(__dirname, "../src/data/convertedProperties.ts"),
  output
);

console.log("✅ Converted full file successfully!");