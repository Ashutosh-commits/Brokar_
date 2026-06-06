export interface Property {
  id: string;
  title: string;
  description: string;
  currentPrice: number;
  location: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  imageUrl: string;
  images?: string[];
  yearBuilt: number;
  propertyType: 'house' | 'apartment' | 'condo' | 'townhouse';
  bhkType: '1BHK' | '2BHK' | '3BHK' | '4BHK' | '5BHK+';
  appreciationRate: number;

  // ── Scraper fields ──────────────────────────────────────────────────────────
  sourceUrl?: string;    // original listing URL (99acres / magicbricks)
  source?: string;       // "99acres" | "magicbricks" | "manual"
  scrapedAt?: string;
}

export interface PricePrediction {
  year: number;
  predictedPrice: number;
}
