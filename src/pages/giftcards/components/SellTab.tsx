import { useState, useRef } from 'react';
import { giftCardApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';

const cardBrands = [
  { id: 'amazon', name: 'Amazon' },
  { id: 'apple', name: 'Apple/iTunes' },
  { id: 'google-play', name: 'Google Play' },
  { id: 'steam', name: 'Steam' },
  { id: 'netflix', name: 'Netflix' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'playstation', name: 'PlayStation' },
  { id: 'xbox', name: 'Xbox' },
  { id: 'nike', name: 'Nike' },
  { id: 'starbucks', name: 'Starbucks' },
];

export default function SellTab() {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [cardCode, setCardCode] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [cardValue, setCardValue] = useState('');
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToastContext();

  const estimatedPayout = cardValue ? (parseFloat(cardValue) * 0.75).toFixed(2) : '0.00';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCardImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !cardCode || !cardValue) return;

    setIsSubmitting(true);
    try {
      const brandName = cardBrands.find(b => b.id === selectedBrand)?.name || selectedBrand;
      const result = await giftCardApi.createRequest({
        type: 'sell',
        brand: brandName,
        amount: parseFloat(cardValue),
        currency: 'USD',
        rate: 75,
        metadata: {
          code: cardCode,
          pin: cardPin,
          estimatedPayout,
          hasImage: !!cardImage
        }
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to submit sell request');
      }

      setShowSuccess(true);
    } catch (error: any) {
      console.error('Sell request failed:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedBrand('');
    setCardCode('');
    setCardPin('');
    setCardValue('');
    setCardImage(null);
    setImagePreview(null);
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-success-500/20 flex items-center justify-center mb-4">
          <i className="ri-check-line text-4xl text-success-400"></i>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Request Submitted!</h3>
        <p className="text-neutral-400 mb-6 max-w-sm">
          Your gift card sell request has been submitted. We'll review it and credit your account within 24 hours.
        </p>
        <div className="bg-dark-elevated rounded-2xl p-4 w-full max-w-sm space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Request ID</span>
            <span className="text-white font-mono">SR-{Date.now().toString(36).toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Card Type</span>
            <span className="text-white">{cardBrands.find(b => b.id === selectedBrand)?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Card Value</span>
            <span className="text-white">${cardValue}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Est. Payout</span>
            <span className="text-lime-400 font-semibold">${estimatedPayout}</span>
          </div>
        </div>
        <button
          onClick={resetForm}
          className="px-8 py-3 bg-lime-500 text-black font-semibold rounded-2xl hover:bg-lime-400 transition-all"
        >
          Sell Another Card
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-medium text-neutral-300 mb-2 block">Card Type</label>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          required
          className="w-full px-4 py-3.5 bg-dark-elevated border border-dark-border rounded-xl text-white focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all appearance-none cursor-pointer"
        >
          <option value="" className="bg-dark-card">Select a brand</option>
          {cardBrands.map((brand) => (
            <option key={brand.id} value={brand.id} className="bg-dark-card">
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300 mb-2 block">Card Code</label>
        <input
          type="text"
          value={cardCode}
          onChange={(e) => setCardCode(e.target.value)}
          placeholder="Enter the card code"
          required
          className="w-full px-4 py-3.5 bg-dark-elevated border border-dark-border rounded-xl text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300 mb-2 block">PIN (if applicable)</label>
        <input
          type="text"
          value={cardPin}
          onChange={(e) => setCardPin(e.target.value)}
          placeholder="Enter the PIN"
          className="w-full px-4 py-3.5 bg-dark-elevated border border-dark-border rounded-xl text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300 mb-2 block">Card Value ($)</label>
        <input
          type="number"
          value={cardValue}
          onChange={(e) => setCardValue(e.target.value)}
          placeholder="Enter the card value"
          required
          min="5"
          max="1000"
          className="w-full px-4 py-3.5 bg-dark-elevated border border-dark-border rounded-xl text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300 mb-2 block">Card Image (Optional)</label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />

        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Card preview"
              className="w-full h-40 object-cover rounded-xl border border-dark-border"
            />
            <button
              type="button"
              onClick={() => {
                setCardImage(null);
                setImagePreview(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-dark-bg/80 rounded-full flex items-center justify-center hover:bg-dark-bg transition-colors"
            >
              <i className="ri-close-line text-white"></i>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-dark-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-lime-400/30 transition-colors"
          >
            <i className="ri-upload-cloud-line text-2xl text-neutral-500"></i>
            <span className="text-sm text-neutral-400">Click to upload card image</span>
          </button>
        )}
      </div>

      {cardValue && (
        <div className="bg-dark-elevated rounded-2xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Card Value</span>
            <span className="text-white">${cardValue}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Rate</span>
            <span className="text-success-400">75%</span>
          </div>
          <div className="h-px bg-dark-border" />
          <div className="flex justify-between">
            <span className="text-neutral-300 font-medium">You'll Receive</span>
            <span className="text-lime-400 font-bold text-lg">${estimatedPayout}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !selectedBrand || !cardCode || !cardValue}
        className="w-full py-4 bg-lime-500 text-black font-semibold rounded-2xl hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <i className="ri-loader-4-line animate-spin"></i>
            Submitting...
          </>
        ) : (
          <>
            <i className="ri-send-plane-fill"></i>
            Submit Sell Request
          </>
        )}
      </button>

      <p className="text-xs text-neutral-500 text-center">
        By submitting, you agree to our terms and conditions for gift card sales
      </p>
    </form>
  );
}
