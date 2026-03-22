import { useState, useEffect } from 'react';
import { useToastContext } from '../../../contexts/ToastContext';

interface CurrencyConverterProps {
  currencyRates: any[];
}

export default function CurrencyConverter({ currencyRates }: CurrencyConverterProps) {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('NGN');
  const [amount, setAmount] = useState('100');
  const [convertedAmount, setConvertedAmount] = useState('0');
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const toast = useToastContext();

  useEffect(() => {
    calculateConversion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromCurrency, toCurrency, transactionType, currencyRates]);

  const FALLBACK_RATES: Record<string, number> = { USD: 1, NGN: 1580, BDT: 110, EUR: 0.92, GBP: 0.79 };
  const FALLBACK_CURRENCIES = [
    { currency_code: 'USD' },
    { currency_code: 'NGN' },
    { currency_code: 'BDT' },
    { currency_code: 'EUR' },
    { currency_code: 'GBP' },
  ];
  const ratesForSelect = currencyRates?.length ? currencyRates : FALLBACK_CURRENCIES;

  const calculateConversion = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setConvertedAmount('0');
      return;
    }

    const fromRate = currencyRates.find(r => r.currency_code === fromCurrency);
    const toRate = currencyRates.find(r => r.currency_code === toCurrency);
    const fromVal = fromRate?.rate_to_usd ?? FALLBACK_RATES[fromCurrency] ?? 1;
    const toVal = toRate?.rate_to_usd ?? FALLBACK_RATES[toCurrency] ?? 1;

    const amountNum = parseFloat(amount);
    const usdAmount = amountNum / fromVal;
    const result = usdAmount * toVal;
    
    setConvertedAmount(result.toFixed(2));
  };

  const handleCreateTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    toast.info('Currency exchange feature coming soon! Please use deposit/withdraw for now.');
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <i className="ri-exchange-line text-emerald-600"></i>
        Currency Converter
      </h2>

      {/* Transaction Type Toggle */}
      <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setTransactionType('buy')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            transactionType === 'buy'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTransactionType('sell')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            transactionType === 'sell'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sell
        </button>
      </div>

      {/* From Currency */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">You Send</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            placeholder="0.00"
          />
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm cursor-pointer"
          >
            {ratesForSelect.map((rate) => (
              <option key={rate.currency_code} value={rate.currency_code}>
                {rate.currency_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exchange Icon */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => {
            const temp = fromCurrency;
            setFromCurrency(toCurrency);
            setToCurrency(temp);
          }}
          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="ri-arrow-up-down-line text-slate-600"></i>
        </button>
      </div>

      {/* To Currency */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">You Receive</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={convertedAmount}
            readOnly
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-sm"
            placeholder="0.00"
          />
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm cursor-pointer"
          >
            {ratesForSelect.map((rate) => (
              <option key={rate.currency_code} value={rate.currency_code}>
                {rate.currency_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Exchange Rate:</span>
          <span className="font-medium text-slate-900">
            1 {fromCurrency} = {(parseFloat(amount || '0') > 0 ? (parseFloat(convertedAmount) / parseFloat(amount)).toFixed(4) : '0.0000')} {toCurrency}
          </span>
        </div>
      </div>

      {/* Create Transaction Button */}
      <button
        onClick={handleCreateTransaction}
        disabled={!amount || parseFloat(amount) <= 0}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {transactionType === 'buy' ? 'Buy' : 'Sell'} Now
      </button>
    </div>
  );
}
