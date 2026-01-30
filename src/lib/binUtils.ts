/**
 * Supported BIN (Bank Identification Number) utilities for prepaid card deposits
 */

export const SUPPORTED_BINS = [
  // Visa Prepaid Cards
  '414398', '414397', '402087', '435880', '440393', '466349', '465568', 
  '413331', '406406', '411352', '403446', '436127', '410881', '443252',
  '428889', '482812', '483317', '486691',
  
  // Mastercard Prepaid Cards
  '542543', '518155', '525691', '524381', '552716', '529580', '555753', 
  '510774', '553231', '530264', '524897', '511332', '534456', '537032', 
  '532211', '549806', '534348', '549825', '516347', '544937', '555243', 
  '555216', '525155'
];

export function isBinSupported(cardNumber: string): boolean {
  const cleanedNumber = cardNumber.replace(/\\s/g, '');
  if (cleanedNumber.length < 6) return false;
  const bin = cleanedNumber.substring(0, 6);
  return SUPPORTED_BINS.includes(bin);
}

export function getCardBrand(cardNumber: string): string {
  const firstDigit = cardNumber.charAt(0);
  const firstTwo = cardNumber.substring(0, 2);
  
  if (firstDigit === '4') return 'VISA';
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'MASTERCARD';
  if (['34', '37'].includes(firstTwo)) return 'AMEX';
  if (firstTwo === '65' || cardNumber.startsWith('6011')) return 'DISCOVER';
  
  return 'UNKNOWN';
}

export function getBinValidation(cardNumber: string): {
  isSupported: boolean;
  brand: string;
  bin: string;
  message: string;
  showWarning: boolean;
} {
  const cleanedNumber = cardNumber.replace(/\\s/g, '');
  
  if (cleanedNumber.length < 6) {
    return {
      isSupported: false,
      brand: 'UNKNOWN',
      bin: cleanedNumber,
      message: '',
      showWarning: false
    };
  }
  
  const bin = cleanedNumber.substring(0, 6);
  const brand = getCardBrand(cleanedNumber);
  const isSupported = SUPPORTED_BINS.includes(bin);
  
  return {
    isSupported,
    brand,
    bin,
    message: isSupported 
      ? `✓ ${brand} prepaid card supported` 
      : `✗ Card BIN (${bin}) not supported`,
    showWarning: !isSupported && cleanedNumber.length >= 6
  };
}

export function getFormattedBinList(): string {
  return SUPPORTED_BINS.join(', ');
}
