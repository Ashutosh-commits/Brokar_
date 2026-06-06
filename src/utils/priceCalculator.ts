import { Property, PricePrediction } from '../types/property';
import { formatIndianPrice } from './indianNumberFormat';

export function calculatePricePrediction(
  property: Property,
  years: number
): number {
  // Compound interest formula: FV = PV * (1 + r)^n
  const futureValue =
    property.currentPrice * Math.pow(1 + property.appreciationRate / 100, years);
  return Math.round(futureValue);
}

export function generatePredictionData(
  property: Property,
  years: number
): PricePrediction[] {
  const data: PricePrediction[] = [];
  
  for (let year = 0; year <= years; year++) {
    data.push({
      year,
      predictedPrice: calculatePricePrediction(property, year),
    });
  }
  
  return data;
}

export function formatCurrency(amount: number): string {
  return formatIndianPrice(amount);
}
