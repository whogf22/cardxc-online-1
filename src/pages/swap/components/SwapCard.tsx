import { useState, useMemo, useCallback } from 'react';
import AssetSelector, { Asset } from './AssetSelector';
import SwapConfirmModal from './SwapConfirmModal';

const ASSETS: Asset[] = [
  { symbol: 'USD', name: 'US Dollar', icon: 'ri-money-dollar-circle-line', color: 'from-green-500 to-green-600', balance: 1250.00 },
  { symbol: 'USDT', name: 'Tether USD', icon: 'ri-money-dollar-circle-line', color: 'from-teal-500 to-teal-600', balance: 500.00 },
  { symbol: 'BTC', name: 'Bitcoin', icon: 'ri-bit-coin-line', color: 'from-orange-500 to-orange-600', balance: 0.0234 },
  { symbol: 'ETH', name: 'Ethereum', icon: 'ri-coin-line', color: 'from-indigo-500 to-indigo-600', balance: 0.85 },
  { symbol: 'BNB', name: 'BNB', icon: 'ri-shape-line', color: 'from-yellow-500 to-yellow-600', balance: 2.5 },
];

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'USD': { 'USDT': 1.00, 'BTC': 0.000023, 'ETH': 0.00042, 'BNB': 0.0033 },
  'USDT': { 'USD': 1.00, 'BTC': 0.000023, 'ETH': 0.00042, 'BNB': 0.0033 },
  'BTC': { 'USD': 43478.26, 'USDT': 43478.26, 'ETH': 18.5, 'BNB': 145.0 },
  'ETH': { 'USD': 2380.95, 'USDT': 2380.95, 'BTC': 0.054, 'BNB': 7.8 },
  'BNB': { 'USD': 303.03, 'USDT': 303.03, 'BTC': 0.0069, 'ETH': 0.128 },
};

const SWAP_FEE = 0.003;

export default function SwapCard() {
  const [fromAsset, setFromAsset] = useState<Asset>(ASSETS[0]);
  const [toAsset, setToAsset] = useState<Asset>(ASSETS[3]);
  const [fromAmount, setFromAmount] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getRate = useCallback((from: string, to: string): number => {
    if (from === to) return 1;
    return EXCHANGE_RATES[from]?.[to] || 0;
  }, []);

  const rate = useMemo(() => getRate(fromAsset.symbol, toAsset.symbol), [fromAsset.symbol, toAsset.symbol, getRate]);

  const toAmount = useMemo(() => {
    if (!fromAmount || isNaN(parseFloat(fromAmount))) return '';
    const amount = parseFloat(fromAmount);
    const converted = amount * rate * (1 - SWAP_FEE);
    if (toAsset.symbol === 'USD' || toAsset.symbol === 'USDT') {
      return converted.toFixed(2);
    }
    return converted.toFixed(8);
  }, [fromAmount, rate, toAsset.symbol]);

  const feeAmount = useMemo(() => {
    if (!fromAmount || isNaN(parseFloat(fromAmount))) return '0.00';
    const amount = parseFloat(fromAmount);
    const fee = amount * SWAP_FEE;
    if (fromAsset.symbol === 'USD' || fromAsset.symbol === 'USDT') {
      return `$${fee.toFixed(2)}`;
    }
    return `${fee.toFixed(6)} ${fromAsset.symbol}`;
  }, [fromAmount, fromAsset.symbol]);

  const priceImpact = useMemo(() => {
    if (!fromAmount || isNaN(parseFloat(fromAmount))) return '0.00';
    const amount = parseFloat(fromAmount);
    const impact = (amount / fromAsset.balance) * 0.1;
    return Math.min(impact, 5).toFixed(2);
  }, [fromAmount, fromAsset.balance]);

  const rateDisplay = useMemo(() => {
    if (rate === 0) return 'N/A';
    if (rate >= 1) {
      return `1 ${fromAsset.symbol} = ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${toAsset.symbol}`;
    }
    return `1 ${fromAsset.symbol} = ${rate.toFixed(8)} ${toAsset.symbol}`;
  }, [rate, fromAsset.symbol, toAsset.symbol]);

  const handleSwapDirection = () => {
    setIsRotating(true);
    setTimeout(() => {
      const temp = fromAsset;
      setFromAsset(toAsset);
      setToAsset(temp);
      setFromAmount('');
      setIsRotating(false);
    }, 150);
  };

  const handleMaxClick = () => {
    if (fromAsset.symbol === 'USD' || fromAsset.symbol === 'USDT') {
      setFromAmount(fromAsset.balance.toFixed(2));
    } else {
      setFromAmount(fromAsset.balance.toFixed(8));
    }
  };

  const handleFromAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
    }
  };

  const handleConfirmSwap = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const isValidSwap = fromAmount && parseFloat(fromAmount) > 0 && parseFloat(fromAmount) <= fromAsset.balance && rate > 0;

  return (
    <>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Swap</h2>
              <p className="text-sm text-slate-500 mt-1">Trade assets instantly</p>
            </div>
            <button className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer">
              <i className="ri-settings-3-line text-xl text-slate-600"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 focus-within:border-emerald-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">From</span>
              <span className="text-sm text-slate-500">
                Balance: {fromAsset.symbol === 'USD' || fromAsset.symbol === 'USDT' 
                  ? fromAsset.balance.toFixed(2) 
                  : fromAsset.balance.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder-slate-300"
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleMaxClick}
                  className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  MAX
                </button>
                <AssetSelector
                  assets={ASSETS}
                  selectedAsset={fromAsset}
                  onSelect={setFromAsset}
                  excludeAsset={toAsset.symbol}
                />
              </div>
            </div>
            {fromAmount && parseFloat(fromAmount) > fromAsset.balance && (
              <p className="text-sm text-red-500 mt-2">Insufficient balance</p>
            )}
          </div>

          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwapDirection}
              className={`w-12 h-12 bg-white border-4 border-slate-100 rounded-xl shadow-lg hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center transition-all cursor-pointer ${
                isRotating ? 'rotate-180' : ''
              }`}
              style={{ transition: 'transform 0.3s ease-in-out, background-color 0.2s, border-color 0.2s' }}
            >
              <i className="ri-arrow-up-down-line text-xl text-emerald-600"></i>
            </button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">To (estimated)</span>
              <span className="text-sm text-slate-500">
                Balance: {toAsset.symbol === 'USD' || toAsset.symbol === 'USDT' 
                  ? toAsset.balance.toFixed(2) 
                  : toAsset.balance.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.00"
                className="flex-1 bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder-slate-300"
              />
              <AssetSelector
                assets={ASSETS}
                selectedAsset={toAsset}
                onSelect={setToAsset}
                excludeAsset={fromAsset.symbol}
              />
            </div>
          </div>

          {fromAmount && parseFloat(fromAmount) > 0 && rate > 0 && (
            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center">
                  <i className="ri-exchange-line mr-2 text-emerald-500"></i>
                  Rate
                </span>
                <span className="text-sm font-semibold text-slate-900">{rateDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center">
                  <i className="ri-percent-line mr-2 text-amber-500"></i>
                  Price Impact
                </span>
                <span className={`text-sm font-semibold ${parseFloat(priceImpact) > 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {priceImpact}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center">
                  <i className="ri-gas-station-line mr-2 text-blue-500"></i>
                  Fee (0.3%)
                </span>
                <span className="text-sm font-semibold text-slate-900">{feeAmount}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={!isValidSwap}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold text-lg rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/30 disabled:shadow-none"
          >
            {!fromAmount || parseFloat(fromAmount) === 0 
              ? 'Enter an amount' 
              : parseFloat(fromAmount) > fromAsset.balance 
                ? 'Insufficient balance' 
                : rate === 0 
                  ? 'Invalid pair' 
                  : 'Swap'}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <SwapConfirmModal
          fromAsset={fromAsset}
          toAsset={toAsset}
          fromAmount={fromAmount}
          toAmount={toAmount}
          rate={rateDisplay}
          fee={feeAmount}
          priceImpact={priceImpact}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmSwap}
        />
      )}
    </>
  );
}
