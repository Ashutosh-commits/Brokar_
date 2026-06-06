import { Property, PricePrediction } from '../types/property';
import { formatIndianPrice } from './indianNumberFormat';

/**
 * Calculate predicted price based on appreciation rate and years
 * Formula: Future Value = Present Value × (1 + rate)^years
 */
export function calculatePredictedPrice(
  currentPrice: number,
  appreciationRate: number,
  years: number
): number {
  const rate = appreciationRate / 100;
  const predictedPrice = currentPrice * Math.pow(1 + rate, years);
  return Math.round(predictedPrice);
}

/**
 * Generate price predictions for multiple years
 */
export function generatePricePredictions(
  property: Property,
  years: number
): PricePrediction[] {
  const predictions: PricePrediction[] = [
    { year: 0, predictedPrice: property.currentPrice }
  ];

  for (let i = 1; i <= years; i++) {
    predictions.push({
      year: i,
      predictedPrice: calculatePredictedPrice(
        property.currentPrice,
        property.appreciationRate,
        i
      ),
    });
  }

  return predictions;
}

/**
 * Format price in Indian Rupees with Indian numbering system
 */
export function formatPrice(price: number): string {
  return formatIndianPrice(price);
}
