import { useState, useRef, useEffect } from 'react';

export interface Asset {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
}

interface AssetSelectorProps {
  assets: Asset[];
  selectedAsset: Asset;
  onSelect: (asset: Asset) => void;
  excludeAsset?: string;
}

export default function AssetSelector({ assets, selectedAsset, onSelect, excludeAsset }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAssets = assets.filter(a => a.symbol !== excludeAsset);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
      >
        <div className={`w-8 h-8 bg-gradient-to-br ${selectedAsset.color} rounded-lg flex items-center justify-center shadow-md`}>
          <i className={`${selectedAsset.icon} text-white text-sm`}></i>
        </div>
        <span className="font-bold text-slate-900">{selectedAsset.symbol}</span>
        <i className={`ri-arrow-down-s-line text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="p-2">
            {filteredAssets.map((asset) => (
              <button
                key={asset.symbol}
                onClick={() => {
                  onSelect(asset);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                  selectedAsset.symbol === asset.symbol 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${asset.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <i className={`${asset.icon} text-white text-lg`}></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">{asset.symbol}</p>
                    <p className="text-xs text-slate-500">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">
                    {asset.symbol === 'USD' || asset.symbol === 'USDT' 
                      ? asset.balance.toFixed(2) 
                      : asset.balance.toFixed(6)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
