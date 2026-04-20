import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Footer from '../home/components/Footer';
import ContactModal from '../home/components/ContactModal';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.cardxc.online/api';

interface GiftCardOffer {
  offerId: string;
  brand: string;
  brandName: string;
  country: string;
  productType: string;
  price: {
    currency: string;
    currencyDivisor: number;
    fixed: number;
    suggestedFixed: number;
    fx: number;
    suggestedFx: number;
    margin: number;
    fee: number;
    feePct: number;
    discount: number;
  };
  enabled: boolean;
}

interface BrandGroup {
  brand: string;
  brandName: string;
  offers: GiftCardOffer[];
  minPrice: number;
  maxPrice: number;
  country: string;
}

export default function GiftCardsPublicPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [offers, setOffers] = useState<GiftCardOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Gift Cards | CardXC \u2014 Buy Gift Cards from 700+ Brands';
  }, []);

  useEffect(() => {
    async function fetchOffers() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/gift-cards/offers?limit=500&offset=0`);
        const data = await res.json();
        if (data.list) setOffers(data.list);
      } catch (e) {
        console.error('Failed to fetch offers:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchOffers();
  }, []);

  const brandGroups = useMemo(() => {
    const groups: Record<string, BrandGroup> = {};
    for (const offer of offers) {
      if (!offer.enabled) continue;
      const key = offer.brand;
      if (!groups[key]) {
        groups[key] = {
          brand: offer.brand,
          brandName: offer.brandName,
          offers: [],
          minPrice: Infinity,
          maxPrice: 0,
          country: offer.country,
        };
      }
      groups[key].offers.push(offer);
      const price = offer.price.fixed / offer.price.currencyDivisor;
      if (price < groups[key].minPrice) groups[key].minPrice = price;
      if (price > groups[key].maxPrice) groups[key].maxPrice = price;
    }
    return Object.values(groups);
  }, [offers]);

  const filteredBrands = useMemo(() => {
    return brandGroups.filter((g) =>
      g.brandName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [brandGroups, searchQuery]);

  return (
    <div className="min-h-screen bg-[#030303] w-full min-w-0 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/90 backdrop-blur-xl border-b border-white/[0.06] safe-top transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-200">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>
            <div className="hidden md:flex items-center gap-0.5">
              <button onClick={() => navigate('/gift-cards')} className="px-4 py-2 text-[13px] font-medium text-lime-400 rounded-lg transition-colors">Gift Cards</button>
              <a href="/#features" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">Features</a>
              <Link to="/how-it-works" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">How It Works</Link>
              <button onClick={() => setIsContactOpen(true)} className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">Contact</button>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-2">
              <button onClick={() => navigate('/signin')} className="px-4 py-2.5 text-sm font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors">Sign In</button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2.5 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all duration-200 shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]">Get Started</button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.08] transition-colors" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
              <i className={`text-xl text-white ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i>
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-28 sm:pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-lime-400 bg-lime-500/10 border border-lime-500/20 rounded-full mb-4">{brandGroups.length}+ Brands</span>
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">Gift Cards</h1>
            <p className="text-neutral-400 text-lg">Browse {brandGroups.length}+ brands. Buy instantly.</p>
          </div>

          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"></i>
              <input
                type="text"
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-lime-500/50 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBrands.map((group) => (
                <div key={group.brand} className="group bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 hover:border-lime-500/30 hover:bg-white/[0.06] transition-all duration-200">
                  <div className="w-12 h-12 bg-lime-500/10 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-lime-400 font-bold text-lg">{group.brandName.charAt(0)}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1 truncate">{group.brandName}</h3>
                  <p className="text-neutral-500 text-xs mb-3">
                    {group.minPrice === group.maxPrice
                      ? `$${group.minPrice.toFixed(0)}`
                      : `$${group.minPrice.toFixed(0)} - $${group.maxPrice.toFixed(0)}`}
                  </p>
                  <button onClick={() => navigate('/signup')} className="text-xs font-semibold text-lime-400 hover:text-lime-300 transition-colors">Buy Now &rarr;</button>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredBrands.length === 0 && (
            <p className="text-center text-neutral-500 py-10">No brands found matching "{searchQuery}"</p>
          )}

          <div className="mt-20 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Create an account to start buying gift cards</h2>
            <p className="text-neutral-400 mb-8">Join CardXC for instant gift card purchases from {brandGroups.length}+ brands worldwide.</p>
            <button onClick={() => navigate('/signup')} className="group px-8 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] text-[15px]">Create Free Account</button>
          </div>
        </div>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
