import { useState, useEffect } from 'react';
import { Search, Grid, List, TrendingUp, Tag, ExternalLink } from 'lucide-react';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = async () => {
    try {
      const response = await userApi.getFluzCategories();
      setCategories(response.data?.categories ?? []);
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
      setMerchants(response.data?.merchants ?? []);
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
      const quote = response.data?.quote;
      if (!quote) throw new Error('No quote returned');
      alert(`Quote for $50:\nOriginal: $${quote.originalPrice}\nDiscounted: $${quote.discountedPrice}\nCashback: $${quote.cashbackAmount}\nValid until: ${new Date(quote.validUntil).toLocaleString()}`);
    } catch (error) {
      console.error('Failed to get quote:', error);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Merchant Directory</h1>
          <p className="text-neutral-400">Discover merchants with cashback offers</p>
        </div>

        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search merchants..."
                  className="input-dark w-full pl-12 pr-4 py-3 rounded-lg text-lg"
                />
              </div>
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-dark w-full px-4 py-3 rounded-lg text-lg"
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
              className="px-8 py-3 bg-lime-500 hover:bg-lime-600 text-white rounded-lg transition-all font-semibold"
            >
              Search
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-lime-500/20 text-lime-400' 
                    : 'bg-dark-elevated text-neutral-500'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-lime-500/20 text-lime-400' 
                    : 'bg-dark-elevated text-neutral-500'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-neutral-400">
            Found <span className="font-semibold text-lime-400">{merchants.length}</span> merchants
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
            <p className="mt-4 text-neutral-400">Loading merchants...</p>
          </div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400 text-lg">No merchants found. Try different search terms.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {merchants.map((merchant) => (
              <div
                key={merchant.merchantId}
                className="bg-dark-card rounded-2xl overflow-hidden hover:border-lime-500/30 transition-all border border-dark-border"
              >
                <div className="h-40 bg-dark-elevated flex items-center justify-center p-6">
                  {merchant.logoUrl ? (
                    <img
                      src={merchant.logoUrl}
                      alt={merchant.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-lime-500/20 rounded-full flex items-center justify-center">
                      <span className="text-3xl font-bold text-lime-400">
                        {merchant.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{merchant.name}</h3>
                  
                  {merchant.category && (
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-lime-400" />
                      <span className="text-sm text-neutral-400">{merchant.category}</span>
                    </div>
                  )}

                  {merchant.description && (
                    <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
                      {merchant.description}
                    </p>
                  )}

                  {merchant.cashbackPercentage && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-500/20 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">
                        {merchant.cashbackPercentage}% Cashback
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => getQuote(merchant.merchantId)}
                    className="w-full px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
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
                className="bg-dark-card rounded-2xl p-6 hover:border-lime-500/30 transition-all border border-dark-border flex items-center gap-6"
              >
                <div className="w-24 h-24 bg-dark-elevated rounded-xl flex items-center justify-center flex-shrink-0">
                  {merchant.logoUrl ? (
                    <img
                      src={merchant.logoUrl}
                      alt={merchant.name}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-lime-400">
                      {merchant.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{merchant.name}</h3>
                  
                  <div className="flex items-center gap-4 mb-2">
                    {merchant.category && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-4 h-4 text-lime-400" />
                        <span className="text-sm text-neutral-400">{merchant.category}</span>
                      </div>
                    )}
                    {merchant.cashbackPercentage && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-semibold">
                          {merchant.cashbackPercentage}% Cashback
                        </span>
                      </div>
                    )}
                  </div>

                  {merchant.description && (
                    <p className="text-sm text-neutral-400">{merchant.description}</p>
                  )}
                </div>

                <button
                  onClick={() => getQuote(merchant.merchantId)}
                  className="px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white rounded-lg transition-all font-semibold whitespace-nowrap flex items-center gap-2"
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
