/**
 * Indian Number Format Utility
 * Formats numbers using Indian numbering system (Lakh/Crore format)
 * Examples:
 *   100000 → 1,00,000 (1 Lakh)
 *   1000000 → 10,00,000 (10 Lakhs)
 *   10000000 → 1,00,00,000 (1 Crore)
 */

/**
 * Format a number in Indian numbering system
 * @param num The number to format
 * @returns Formatted string in Indian system
 */
export function formatIndianNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  
  const numStr = Math.abs(Math.round(num)).toString();
  
  // If less than 4 digits (0-999), return as is
  if (numStr.length <= 3) {
    return (num < 0 ? '-' : '') + numStr;
  }
  
  // For numbers with 4+ digits, apply Indian comma system:
  // First 3 digits from right, then every 2 digits
  const reversed = numStr.split('').reverse().join('');
  const parts: string[] = [];
  
  // First part: 3 digits from the right
  parts.push(reversed.substring(0, 3));
  
  // Remaining parts: 2 digits each
  for (let i = 3; i < reversed.length; i += 2) {
    parts.push(reversed.substring(i, i + 2));
  }
  
  const formatted = parts
    .map(part => part.split('').reverse().join(''))
    .reverse()
    .join(',');
  
  return (num < 0 ? '-' : '') + formatted;
}

/**
 * Format price in Indian Rupees with Indian numbering system
 * @param price The price in rupees
 * @returns Formatted currency string (e.g., "₹1,00,000")
 */
export function formatIndianPrice(price: number): string {
  return `₹${formatIndianNumber(price)}`;
}

/**
 * Get readable price label for large numbers (Lakh/Crore)
 * @param price The price in rupees
 * @returns Readable label (e.g., "1.25 Cr", "50 L")
 */
export function formatIndianPriceReadable(price: number): string {
  const absPrice = Math.abs(price);
  const sign = price < 0 ? '-' : '';
  
  if (absPrice >= 10000000) {
    // Crore (1 Cr = 1,00,00,000)
    return `${sign}₹${(absPrice / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (absPrice >= 100000) {
    // Lakh (1 L = 1,00,000)
    return `${sign}₹${(absPrice / 100000).toFixed(2).replace(/\.?0+$/, '')} L`;
  } else {
    // Regular number
    return `${sign}₹${formatIndianNumber(absPrice)}`;
  }
}
