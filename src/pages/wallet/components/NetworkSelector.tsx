interface Network {
  id: string;
  name: string;
  fullName: string;
  icon: string;
  fee: string;
  confirmations: number;
  minDeposit: string;
  depositAddress: string;
}

interface NetworkSelectorProps {
  networks: Network[];
  selectedNetwork: string;
  onSelect: (networkId: string) => void;
  disabled?: boolean;
}

export default function NetworkSelector({ networks, selectedNetwork, onSelect, disabled }: NetworkSelectorProps) {
  const selectedNetworkData = networks.find(n => n.id === selectedNetwork);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Select Network
      </label>
      <div className="space-y-2">
        {networks.map((network) => (
          <button
            key={network.id}
            onClick={() => onSelect(network.id)}
            disabled={disabled}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
              selectedNetwork === network.id
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                selectedNetwork === network.id ? 'bg-emerald-500' : 'bg-slate-100'
              }`}>
                <i className={`${network.icon} text-lg ${
                  selectedNetwork === network.id ? 'text-white' : 'text-slate-600'
                }`}></i>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">{network.name}</p>
                <p className="text-xs text-slate-500">{network.fullName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Fee: {network.fee}</p>
              <p className="text-xs text-slate-400">{network.confirmations} confirmations</p>
            </div>
          </button>
        ))}
      </div>
      
      {selectedNetworkData && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <i className="ri-alert-line text-amber-600 mt-0.5"></i>
            <div>
              <p className="text-sm font-medium text-amber-800">Network Warning</p>
              <p className="text-xs text-amber-700 mt-1">
                Only send assets via the <span className="font-bold">{selectedNetworkData.name}</span> network. 
                Sending via other networks may result in permanent loss of funds.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
