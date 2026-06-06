/**
 * Custom hooks for calculating and updating statistics
 */

import { useMemo } from 'react';
import { Property } from '../types/property';

/**
 * Calculate and return live statistics for properties
 * Automatically updates when properties array changes
 */
export function usePropertyStats(properties: Property[]) {
  return useMemo(() => {
    if (properties.length === 0) {
      return {
        totalProperties: 0,
        averagePrice: 0,
        averageAppreciation: 0,
        minPrice: 0,
        maxPrice: 0,
        totalValue: 0,
      };
    }

    const totalValue = properties.reduce((sum, p) => sum + p.currentPrice, 0);
    const totalAppreciation = properties.reduce((sum, p) => sum + p.appreciationRate, 0);

    return {
      totalProperties: properties.length,
      averagePrice: Math.round(totalValue / properties.length),
      averageAppreciation: +(totalAppreciation / properties.length).toFixed(1),
      minPrice: Math.min(...properties.map(p => p.currentPrice)),
      maxPrice: Math.max(...properties.map(p => p.currentPrice)),
      totalValue,
    };
  }, [properties]);
}

/**
 * Format stats for display
 */
export function useFormattedStats(properties: Property[]) {
  const stats = usePropertyStats(properties);

  return useMemo(() => {
    const formatPrice = (price: number) => {
      if (price >= 10000000) {
        return `₹${(price / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
      } else if (price >= 100000) {
        return `₹${(price / 100000).toFixed(2).replace(/\.?0+$/, '')} L`;
      }
      return `₹${price.toLocaleString('en-IN')}`;
    };

    return {
      ...stats,
      averagePriceFormatted: formatPrice(stats.averagePrice),
      minPriceFormatted: formatPrice(stats.minPrice),
      maxPriceFormatted: formatPrice(stats.maxPrice),
      totalValueFormatted: formatPrice(stats.totalValue),
    };
  }, [stats]);
}
