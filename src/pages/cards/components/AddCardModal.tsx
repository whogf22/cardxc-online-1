import { useState, useEffect } from 'react';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (card: PrepaidCardData) => void;
  editingCard?: PrepaidCardData | null;
  onEdit?: (card: PrepaidCardData) => void;
}

export interface PrepaidCardData {
  id: string;
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  provider: 'VISA' | 'MASTERCARD' | 'AMEX';
  lastFour: string;
  billingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  createdAt: string;
}

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Japan', 'Singapore', 'India', 'Brazil', 'Mexico', 'Spain',
  'Italy', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Ireland', 'New Zealand', 'South Africa', 'United Arab Emirates'
];

export default function AddCardModal({ isOpen, onClose, onAdd, editingCard, onEdit }: AddCardModalProps) {
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [showBillingAddress, setShowBillingAddress] = useState(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!editingCard;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (editingCard) {
        setCardholderName(editingCard.cardholderName);
        const raw = editingCard.cardNumber.replace(/\s/g, '');
        setCardNumber(raw.match(/.{1,4}/g)?.join(' ') || raw);
        setExpiryDate(editingCard.expiryDate);
        setCvv(editingCard.cvv);
        setShowBillingAddress(!!editingCard.billingAddress?.addressLine1);
        setAddressLine1(editingCard.billingAddress?.addressLine1 || '');
        setAddressLine2(editingCard.billingAddress?.addressLine2 || '');
        setCity(editingCard.billingAddress?.city || '');
        setState(editingCard.billingAddress?.state || '');
        setPostalCode(editingCard.billingAddress?.postalCode || '');
        setCountry(editingCard.billingAddress?.country || '');
      } else {
        setCardholderName('');
        setCardNumber('');
        setExpiryDate('');
        setCvv('');
        setShowBillingAddress(false);
        setAddressLine1('');
        setAddressLine2('');
        setCity('');
        setState('');
        setPostalCode('');
        setCountry('');
      }
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingCard?.id]);

  const detectCardType = (number: string): 'VISA' | 'MASTERCARD' | 'AMEX' | null => {
    const cleanNumber = number.replace(/\s/g, '');
    if (/^4/.test(cleanNumber)) return 'VISA';
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'MASTERCARD';
    if (/^3[47]/.test(cleanNumber)) return 'AMEX';
    return null;
  };

  const formatCardNumber = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const cardType = detectCardType(cleanValue);
    if (cardType === 'AMEX') {
      const match = cleanValue.match(/^(\d{0,4})(\d{0,6})(\d{0,5})$/);
      if (match) {
        return [match[1], match[2], match[3]].filter(Boolean).join(' ');
      }
    }
    const groups = cleanValue.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleanValue;
  };

  const formatExpiryDate = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length >= 2) {
      return cleanValue.slice(0, 2) + '/' + cleanValue.slice(2, 4);
    }
    return cleanValue;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    const maxLength = detectCardType(formatted) === 'AMEX' ? 17 : 19;
    if (formatted.length <= maxLength) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) {
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const maxLength = detectCardType(cardNumber) === 'AMEX' ? 4 : 3;
    if (value.length <= maxLength) {
      setCvv(value);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }
    
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    const cardType = detectCardType(cleanCardNumber);
    if (!cleanCardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (cardType === 'AMEX' && cleanCardNumber.length !== 15) {
      newErrors.cardNumber = 'American Express cards must have 15 digits';
    } else if (cardType !== 'AMEX' && cleanCardNumber.length !== 16) {
      newErrors.cardNumber = 'Card number must be 16 digits';
    }
    
    if (!expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      newErrors.expiryDate = 'Invalid format (MM/YY)';
    } else {
      const [month, year] = expiryDate.split('/').map(Number);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100;
      const currentMonth = currentDate.getMonth() + 1;
      if (month < 1 || month > 12) {
        newErrors.expiryDate = 'Invalid month';
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        newErrors.expiryDate = 'Card has expired';
      }
    }
    
    const cvvLength = cardType === 'AMEX' ? 4 : 3;
    if (!cvv) {
      newErrors.cvv = 'CVV is required';
    } else if (cvv.length !== cvvLength) {
      newErrors.cvv = `CVV must be ${cvvLength} digits`;
    }
    
    if (showBillingAddress) {
      if (!addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
      if (!city.trim()) newErrors.city = 'City is required';
      if (!state.trim()) newErrors.state = 'State/Province is required';
      if (!postalCode.trim()) newErrors.postalCode = 'Postal code is required';
      if (!country) newErrors.country = 'Country is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = (): boolean => {
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    const cardType = detectCardType(cleanCardNumber);
    const expectedCardLength = cardType === 'AMEX' ? 15 : 16;
    const expectedCvvLength = cardType === 'AMEX' ? 4 : 3;
    
    const baseValid = 
      cardholderName.trim().length > 0 &&
      cleanCardNumber.length === expectedCardLength &&
      /^\d{2}\/\d{2}$/.test(expiryDate) &&
      cvv.length === expectedCvvLength;
    
    if (!showBillingAddress) return baseValid;
    
    return baseValid &&
      addressLine1.trim().length > 0 &&
      city.trim().length > 0 &&
      state.trim().length > 0 &&
      postalCode.trim().length > 0 &&
      country.length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      const provider = detectCardType(cleanCardNumber) || 'VISA';
      
      const cardData: PrepaidCardData = {
        id: editingCard?.id || `card_${Date.now()}`,
        cardholderName,
        cardNumber: cleanCardNumber,
        expiryDate,
        cvv,
        provider,
        lastFour: cleanCardNumber.slice(-4),
        billingAddress: showBillingAddress ? {
          addressLine1,
          addressLine2: addressLine2 || undefined,
          city,
          state,
          postalCode,
          country,
        } : {
          addressLine1: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        status: 'ACTIVE',
        createdAt: editingCard?.createdAt || new Date().toISOString(),
      };
      
      await new Promise(resolve => setTimeout(resolve, 300));
      if (isEditing && onEdit) {
        onEdit(cardData);
      } else {
        onAdd(cardData);
      }
      onClose();
    } catch (error) {
      console.error('[AddCardModal] Failed to add card:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cardType = detectCardType(cardNumber);

  const renderCardIcon = () => {
    switch (cardType) {
      case 'VISA':
        return (
          <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold italic">VISA</span>
          </div>
        );
      case 'MASTERCARD':
        return (
          <div className="w-10 h-6 flex items-center justify-center">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            </div>
          </div>
        );
      case 'AMEX':
        return (
          <div className="w-10 h-6 bg-blue-800 rounded flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">AMEX</span>
          </div>
        );
      default:
        return (
          <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center">
            <i className="ri-bank-card-line text-gray-400 text-sm"></i>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col min-h-0 animate-slide-up sm:animate-none sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 id="add-card-title" className="text-base sm:text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Card' : 'Add Prepaid Card'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
              {isEditing ? 'Update your card details' : 'Spend your debit/credit card by adding details below'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-xl text-gray-500"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 min-h-0">
          <div className="space-y-4 pb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="John Doe"
                className={`w-full px-4 py-3 sm:py-3 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 transition-all min-h-[44px] ${
                  errors.cardholderName
                    ? 'border-red-300 focus:ring-red-500 bg-red-50'
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {errors.cardholderName && (
                <p className="mt-1 text-xs text-red-500">{errors.cardholderName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Card Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  className={`w-full px-4 py-3 sm:py-3 pr-14 border rounded-xl text-base sm:text-sm font-mono focus:outline-none focus:ring-2 transition-all min-h-[44px] ${
                    errors.cardNumber
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {renderCardIcon()}
                </div>
              </div>
              {errors.cardNumber && (
                <p className="mt-1 text-xs text-red-500">{errors.cardNumber}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={expiryDate}
                  onChange={handleExpiryChange}
                  placeholder="MM/YY"
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
                    errors.expiryDate
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {errors.expiryDate && (
                  <p className="mt-1 text-xs text-red-500">{errors.expiryDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  CVV
                </label>
                <input
                  type="text"
                  value={cvv}
                  onChange={handleCvvChange}
                  placeholder={cardType === 'AMEX' ? '1234' : '123'}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
                    errors.cvv
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {errors.cvv && (
                  <p className="mt-1 text-xs text-red-500">{errors.cvv}</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowBillingAddress(!showBillingAddress)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <i className={`transition-transform ${showBillingAddress ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                Billing Address
                <span className="text-xs text-gray-400">(optional)</span>
              </button>
            </div>

            {showBillingAddress && (
              <div className="space-y-4 pt-2 border-t border-gray-100 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="123 Main Street"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.addressLine1
                        ? 'border-red-300 focus:ring-red-500 bg-red-50'
                        : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {errors.addressLine1 && (
                    <p className="mt-1 text-xs text-red-500">{errors.addressLine1}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Address Line 2 <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Apt 4B"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="New York"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.city
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    {errors.city && (
                      <p className="mt-1 text-xs text-red-500">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="NY"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.state
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    {errors.state && (
                      <p className="mt-1 text-xs text-red-500">{errors.state}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="10001"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.postalCode
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    {errors.postalCode && (
                      <p className="mt-1 text-xs text-red-500">{errors.postalCode}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all appearance-none bg-white ${
                        errors.country
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    >
                      <option value="">Select...</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500">{errors.country}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 pb-[env(safe-area-inset-bottom)] sm:pb-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!isFormValid() || isLoading}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Adding...
                </>
              ) : (
                isEditing ? 'Save Changes' : 'Proceed'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
