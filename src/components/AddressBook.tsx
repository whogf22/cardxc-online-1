import { useState, useMemo } from 'react';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  network: string;
  coin: string;
  lastUsed?: string;
  createdAt: string;
}

interface AddressBookProps {
  isModal?: boolean;
  onClose?: () => void;
  onSelectAddress?: (address: SavedAddress) => void;
  filterNetwork?: string;
}

const NETWORKS = [
  { id: 'btc-native', name: 'Bitcoin', coin: 'BTC', icon: 'ri-bit-coin-line', color: 'from-orange-500 to-orange-600' },
  { id: 'eth-erc20', name: 'Ethereum (ERC-20)', coin: 'ETH', icon: 'ri-coin-line', color: 'from-indigo-500 to-indigo-600' },
  { id: 'usdt-erc20', name: 'USDT (ERC-20)', coin: 'USDT', icon: 'ri-money-dollar-circle-line', color: 'from-teal-500 to-teal-600' },
  { id: 'usdt-trc20', name: 'USDT (TRC-20)', coin: 'USDT', icon: 'ri-money-dollar-circle-line', color: 'from-teal-500 to-teal-600' },
  { id: 'usdt-bep20', name: 'USDT (BEP-20)', coin: 'USDT', icon: 'ri-money-dollar-circle-line', color: 'from-teal-500 to-teal-600' },
  { id: 'bnb-bep20', name: 'BNB (BEP-20)', coin: 'BNB', icon: 'ri-shape-line', color: 'from-yellow-500 to-yellow-600' },
  { id: 'trx-trc20', name: 'Tron (TRC-20)', coin: 'TRX', icon: 'ri-flashlight-line', color: 'from-red-500 to-red-600' },
];


export default function AddressBook({ isModal = false, onClose, onSelectAddress, filterNetwork }: AddressBookProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [recentAddresses] = useState<SavedAddress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>(filterNetwork || 'all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  };

  const [newAddress, setNewAddress] = useState({
    label: '',
    address: '',
    network: 'eth-erc20',
  });

  const filteredAddresses = useMemo(() => {
    return savedAddresses.filter(addr => {
      const matchesSearch = addr.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           addr.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNetwork = selectedNetwork === 'all' || addr.network === selectedNetwork;
      return matchesSearch && matchesNetwork;
    });
  }, [savedAddresses, searchQuery, selectedNetwork]);

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const copyToClipboard = async (address: string, id: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getNetworkInfo = (networkId: string) => {
    return NETWORKS.find(n => n.id === networkId) || NETWORKS[0];
  };

  const validateAddress = (address: string, network: string): boolean => {
    if (!address) return false;
    if (network === 'btc-native') {
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    }
    if (network.includes('trc20')) {
      return /^T[a-zA-HJ-NP-Z0-9]{33}$/.test(address);
    }
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSaveAddress = () => {
    if (!newAddress.label || !newAddress.address) return;
    if (!validateAddress(newAddress.address, newAddress.network)) return;

    const networkInfo = getNetworkInfo(newAddress.network);
    const newEntry: SavedAddress = {
      id: generateId(),
      label: newAddress.label,
      address: newAddress.address,
      network: newAddress.network,
      coin: networkInfo.coin,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSavedAddresses(prev => [...prev, newEntry]);
    setNewAddress({ label: '', address: '', network: 'eth-erc20' });
    setShowAddForm(false);
  };

  const handleUpdateAddress = () => {
    if (!editingAddress) return;
    setSavedAddresses(prev => prev.map(addr => 
      addr.id === editingAddress.id ? editingAddress : addr
    ));
    setEditingAddress(null);
  };

  const handleDeleteAddress = (id: string) => {
    setSavedAddresses(prev => prev.filter(addr => addr.id !== id));
  };

  const handleAddToSaved = (address: SavedAddress) => {
    setNewAddress({
      label: '',
      address: address.address,
      network: address.network,
    });
    setShowAddForm(true);
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by label or address..."
            className="input-dark w-full pl-10 pr-4 py-3 rounded-xl"
          />
        </div>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value)}
          className="input-dark px-4 py-3 rounded-xl"
        >
          <option value="all">All Networks</option>
          {NETWORKS.map(network => (
            <option key={network.id} value={network.id}>{network.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-xl transition-all cursor-pointer"
        >
          <i className="ri-add-line"></i>
          <span>Add New</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-dark-elevated border border-dark-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Add New Address</h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewAddress({ label: '', address: '', network: 'eth-erc20' });
              }}
              className="w-8 h-8 rounded-full hover:bg-dark-bg flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl text-neutral-400"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">Label/Nickname</label>
              <input
                type="text"
                value={newAddress.label}
                onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., My Crypto Wallet"
                className="input-dark w-full px-4 py-3 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">Network</label>
              <select
                value={newAddress.network}
                onChange={(e) => setNewAddress(prev => ({ ...prev, network: e.target.value }))}
                className="input-dark w-full px-4 py-3 rounded-xl"
              >
                {NETWORKS.map(network => (
                  <option key={network.id} value={network.id}>{network.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">Wallet Address</label>
            <input
              type="text"
              value={newAddress.address}
              onChange={(e) => setNewAddress(prev => ({ ...prev, address: e.target.value }))}
              placeholder={
                newAddress.network === 'btc-native' ? 'bc1q... or 1... or 3...' :
                newAddress.network.includes('trc20') ? 'T...' : '0x...'
              }
              className={`input-dark w-full px-4 py-3 font-mono text-sm rounded-xl ${
                newAddress.address && !validateAddress(newAddress.address, newAddress.network)
                  ? 'border-red-500/50'
                  : ''
              }`}
            />
            {newAddress.address && !validateAddress(newAddress.address, newAddress.network) && (
              <p className="text-sm text-red-400 mt-1">Invalid address format for selected network</p>
            )}
          </div>
          <button
            onClick={handleSaveAddress}
            disabled={!newAddress.label || !newAddress.address || !validateAddress(newAddress.address, newAddress.network)}
            className="w-full py-3 bg-lime-500 hover:bg-lime-600 disabled:bg-neutral-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all cursor-pointer"
          >
            Save Address
          </button>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-white mb-4">Saved Addresses</h3>
        {filteredAddresses.length === 0 ? (
          <div className="text-center py-12 bg-dark-elevated rounded-xl border border-dark-border">
            <i className="ri-bookmark-line text-4xl text-neutral-500 mb-3"></i>
            <p className="text-neutral-400 font-medium">No saved addresses found</p>
            <p className="text-sm text-neutral-500 mt-1">Add a new address to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAddresses.map(address => {
              const networkInfo = getNetworkInfo(address.network);
              return (
                <div
                  key={address.id}
                  className={`p-4 bg-dark-elevated rounded-xl border transition-all ${
                    onSelectAddress ? 'border-dark-border hover:border-lime-500/50 cursor-pointer' : 'border-dark-border'
                  }`}
                  onClick={() => onSelectAddress?.(address)}
                >
                  {editingAddress?.id === address.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingAddress.label}
                        onChange={(e) => setEditingAddress(prev => prev ? { ...prev, label: e.target.value } : null)}
                        className="input-dark w-full px-3 py-2 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateAddress(); }}
                          className="px-3 py-1 bg-lime-500 text-white text-sm rounded-lg hover:bg-lime-600 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingAddress(null); }}
                          className="px-3 py-1 bg-dark-bg text-neutral-300 text-sm rounded-lg hover:bg-dark-border cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${networkInfo.color} rounded-xl flex items-center justify-center shadow-lg`}>
                          <i className={`${networkInfo.icon} text-white text-lg`}></i>
                        </div>
                        <div>
                          <p className="font-bold text-white">{address.label}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-mono text-neutral-400">{truncateAddress(address.address)}</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(address.address, address.id); }}
                              className="text-neutral-500 hover:text-lime-400 transition-colors cursor-pointer"
                            >
                              <i className={copiedId === address.id ? 'ri-check-line text-lime-400' : 'ri-file-copy-line'}></i>
                            </button>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-dark-bg text-neutral-400 rounded-full">{address.coin}</span>
                            <span className="text-xs text-neutral-500">{networkInfo.name}</span>
                            {address.lastUsed && (
                              <span className="text-xs text-neutral-500">• Last used: {address.lastUsed}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!onSelectAddress && (
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingAddress(address); }}
                            className="w-8 h-8 rounded-lg hover:bg-dark-bg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <i className="ri-edit-line text-neutral-400"></i>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteAddress(address.id); }}
                            className="w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <i className="ri-delete-bin-line text-red-400"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-4">Recently Sent To</h3>
        {recentAddresses.length === 0 ? (
          <div className="text-center py-8 bg-dark-elevated rounded-xl border border-dark-border">
            <i className="ri-history-line text-3xl text-neutral-500 mb-2"></i>
            <p className="text-sm text-neutral-500">No recent transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAddresses.slice(0, 5).map(address => {
              const networkInfo = getNetworkInfo(address.network);
              const isSaved = savedAddresses.some(a => a.address.toLowerCase() === address.address.toLowerCase());
              return (
                <div
                  key={address.id}
                  className={`p-3 bg-dark-elevated rounded-xl border border-dark-border flex items-center justify-between ${
                    onSelectAddress ? 'hover:border-lime-500/50 cursor-pointer' : ''
                  }`}
                  onClick={() => onSelectAddress?.(address)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 bg-gradient-to-br ${networkInfo.color} rounded-lg flex items-center justify-center`}>
                      <i className={`${networkInfo.icon} text-white text-sm`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-mono text-neutral-300">{truncateAddress(address.address)}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-500">{networkInfo.name}</span>
                        {address.lastUsed && (
                          <span className="text-xs text-neutral-500">• {address.lastUsed}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(address.address, address.id); }}
                      className="w-8 h-8 rounded-lg hover:bg-dark-bg flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <i className={copiedId === address.id ? 'ri-check-line text-lime-400' : 'ri-file-copy-line text-neutral-400'}></i>
                    </button>
                    {!isSaved && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToSaved(address); }}
                        className="w-8 h-8 rounded-lg hover:bg-lime-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Save to address book"
                      >
                        <i className="ri-bookmark-line text-lime-400"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-dark-border flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Address Book</h2>
              <p className="text-sm text-neutral-400 mt-1">Select an address or add a new one</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-dark-elevated flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-neutral-400"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}
