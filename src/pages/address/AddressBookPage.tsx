import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Check, Home } from 'lucide-react';
import { userApi } from '../../lib/api';

interface FluzAddress {
  addressId: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export default function AddressBookPage() {
  const [addresses, setAddresses] = useState<FluzAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    isDefault: false
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const response = await userApi.getFluzAddresses();
      setAddresses(response.data?.addresses ?? []);
    } catch (error) {
      console.error('Failed to load addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userApi.saveFluzAddress(formData);
      setShowAddModal(false);
      setFormData({
        streetAddress: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        isDefault: false
      });
      loadAddresses();
    } catch (error) {
      console.error('Failed to save address:', error);
      alert('Failed to save address');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Address Book</h1>
            <p className="text-neutral-400">Manage your saved addresses</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Address
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
            <p className="mt-4 text-neutral-400">Loading addresses...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-20 bg-dark-card rounded-2xl border border-dark-border">
            <MapPin className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400 text-lg mb-4">No addresses saved yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white rounded-xl font-semibold transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((address) => (
              <div
                key={address.addressId}
                className={`bg-dark-card rounded-2xl p-6 border ${
                  address.isDefault ? 'border-lime-500/50' : 'border-dark-border'
                } transition-all`}
              >
                {address.isDefault && (
                  <div className="flex items-center gap-2 mb-4 text-lime-400">
                    <Home className="w-5 h-5" />
                    <span className="font-semibold">Default Address</span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-lime-500/20 rounded-xl flex-shrink-0">
                    <MapPin className="w-6 h-6 text-lime-400" />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-white mb-1">
                      {address.streetAddress}
                    </p>
                    <p className="text-neutral-400 text-sm">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p className="text-neutral-400 text-sm">{address.country}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-dark-border">
                  <button className="flex-1 px-4 py-2 bg-dark-elevated text-neutral-300 rounded-lg hover:bg-dark-border transition-all flex items-center justify-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-card border border-dark-border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <h2 className="text-3xl font-bold text-white mb-6">Add New Address</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-400 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      className="input-dark w-full px-4 py-3 rounded-lg"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-400 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="input-dark w-full px-4 py-3 rounded-lg"
                        placeholder="New York"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-400 mb-2">
                        State *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="input-dark w-full px-4 py-3 rounded-lg"
                        placeholder="NY"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-400 mb-2">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        className="input-dark w-full px-4 py-3 rounded-lg"
                        placeholder="10001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-400 mb-2">
                        Country *
                      </label>
                      <select
                        required
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="input-dark w-full px-4 py-3 rounded-lg"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-5 h-5 text-lime-500 rounded focus:ring-2 focus:ring-lime-500"
                    />
                    <label htmlFor="isDefault" className="text-sm font-medium text-neutral-400">
                      Set as default address
                    </label>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-6 py-3 bg-dark-elevated text-neutral-300 rounded-lg hover:bg-dark-border transition-all font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Save Address
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
