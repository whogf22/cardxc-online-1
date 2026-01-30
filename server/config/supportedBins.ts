/**
 * Supported BIN (Bank Identification Number) list for prepaid card deposits
 * These are the first 6 digits of card numbers that are accepted
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

export const BIN_BRANDS: Record<string, string> = {
  '4': 'VISA',
  '51': 'MASTERCARD', '52': 'MASTERCARD', '53': 'MASTERCARD', '54': 'MASTERCARD', '55': 'MASTERCARD',
  '34': 'AMEX', '37': 'AMEX',
  '6011': 'DISCOVER', '65': 'DISCOVER'
};

export function isBinSupported(cardNumber: string): boolean {
  const cleanedNumber = cardNumber.replace(/\s/g, '');
  if (cleanedNumber.length < 6) return false;
  
  const bin = cleanedNumber.substring(0, 6);
  return SUPPORTED_BINS.includes(bin);
}

export function getCardBrand(cardNumber: string): string {
  const firstDigit = cardNumber.charAt(0);
  const firstTwo = cardNumber.substring(0, 2);
  const firstFour = cardNumber.substring(0, 4);
  
  if (BIN_BRANDS[firstFour]) return BIN_BRANDS[firstFour];
  if (BIN_BRANDS[firstTwo]) return BIN_BRANDS[firstTwo];
  if (BIN_BRANDS[firstDigit]) return BIN_BRANDS[firstDigit];
  
  return 'UNKNOWN';
}

export function getBinInfo(cardNumber: string): {
  isSupported: boolean;
  brand: string;
  bin: string;
  message: string;
} {
  const cleanedNumber = cardNumber.replace(/\s/g, '');
  
  if (cleanedNumber.length < 6) {
    return {
      isSupported: false,
      brand: 'UNKNOWN',
      bin: cleanedNumber,
      message: 'Enter at least 6 digits'
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
      : `✗ This card BIN (${bin}) is not supported. Please use a supported prepaid giftcard.`
  };
}

// Export formatted BIN list for display
export function getFormattedBinList(): string {
  return SUPPORTED_BINS.join(', ');
}
