import { useState, useEffect } from 'react';
import { Search, Grid, List, Star, TrendingUp, MapPin, Tag, ExternalLink } from 'lucide-react';
import { userApi } from '../../lib/api';

interface FluzMerchant {
  merchantId: string;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  cashbackPercentage?: number;
  status: string;
}

interface FluzBusinessCategory {
  categoryId: string;
  name: string;
  subCategories?: Array<{ categoryId: string; name: string }>;
}

export default function MerchantSearchPage() {
  const [merchants, setMerchants] = useState<FluzMerchant[]>([]);
  const [categories, setCategories] = useState<FluzBusinessCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadCategories();
    loadMerchants();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await userApi.getFluzCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (selectedCategory) params.category = selectedCategory;
      if (searchTerm) params.search = searchTerm;

      const response = await userApi.getFluzMerchants({
        limit: 50,
        category: selectedCategory,
        search: searchTerm
      });
      setMerchants(response.merchants);
    } catch (error) {
      console.error('Failed to load merchants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadMerchants();
  };

  const getQuote = async (merchantId: string) => {
    try {
      const response = await userApi.getFluzQuote(merchantId, 50);
      const quote = response.quote;
      alert(`Quote for $50:\nOriginal: $${quote.originalPrice}\nDiscounted: $${quote.discountedPrice}\nCashback: $${quote.cashbackAmount}\nValid until: ${new Date(quote.validUntil).toLocaleString()}`);
    } catch (error) {
      console.error('Failed to get quote:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Merchant Directory</h1>
          <p className="text-gray-600">Discover merchants with cashback offers</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search merchants..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
                />
              </div>
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.categoryId} value={cat.categoryId}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handleSearch}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              Search
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">
            Found <span className="font-semibold text-purple-600">{merchants.length}</span> merchants
          </p>
        </div>

        {/* Merchants Grid/List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading merchants...</p>
          </div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No merchants found. Try different search terms.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {merchants.map((merchant) => (
              <div
                key={merchant.merchantId}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow border border-gray-100"
              >
                {/* Logo */}
                <div className="h-40 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center p-6">
                  {merchant.logoUrl ? (
                    <img
                      src={merchant.logoUrl}
                      alt={merchant.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                      <span className="text-3xl font-bold text-purple-600">
                        {merchant.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{merchant.name}</h3>
                  
                  {merchant.category && (
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-600">{merchant.category}</span>
                    </div>
                  )}

                  {merchant.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {merchant.description}
                    </p>
                  )}

                  {merchant.cashbackPercentage && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-semibold">
                        {merchant.cashbackPercentage}% Cashback
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => getQuote(merchant.merchantId)}
                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
                  >
                    Get Quote
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {merchants.map((merchant) => (
              <div
                key={merchant.merchantId}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-shadow border border-gray-100 flex items-center gap-6"
              >
                {/* Logo */}
                <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {merchant.logoUrl ? (
                    <img
                      src={merchant.logoUrl}
                      alt={merchant.name}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-purple-600">
                      {merchant.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{merchant.name}</h3>
                  
                  <div className="flex items-center gap-4 mb-2">
                    {merchant.category && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-4 h-4 text-purple-600" />
                        <span className="text-sm text-gray-600">{merchant.category}</span>
                      </div>
                    )}
                    {merchant.cashbackPercentage && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-semibold">
                          {merchant.cashbackPercentage}% Cashback
                        </span>
                      </div>
                    )}
                  </div>

                  {merchant.description && (
                    <p className="text-sm text-gray-600">{merchant.description}</p>
                  )}
                </div>

                <button
                  onClick={() => getQuote(merchant.merchantId)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold whitespace-nowrap flex items-center gap-2"
                >
                  Get Quote
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
