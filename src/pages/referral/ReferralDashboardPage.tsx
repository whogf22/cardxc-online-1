import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Users, DollarSign, Copy, Share2, TrendingUp, Award, Check, ArrowLeft } from 'lucide-react';
import { userApi } from '../../lib/api';

interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  stats: {
    successfulReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
  };
}

export default function ReferralDashboardPage() {
  const navigate = useNavigate();
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    try {
      setLoading(true);
      const response = await userApi.getFluzReferralInfo();
      if (response.success && response.data) {
        // Server returns { referralCode, referralLink, stats } directly in data
        setReferralInfo(response.data as unknown as ReferralInfo);
      }
    } catch (error) {
      console.error('Failed to load referral info:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ourReferralUrl = referralInfo
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${referralInfo.referralCode}`
    : '';

  const shareReferral = async () => {
    if (!referralInfo || !ourReferralUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CardXC!',
          text: `Use my referral code ${referralInfo.referralCode} to get amazing cashback on gift cards!`,
          url: ourReferralUrl
        });
      } catch {
        console.log('Share canceled');
      }
    } else {
      copyToClipboard(ourReferralUrl);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
          <p className="mt-4 text-neutral-400">Loading referral dashboard...</p>
        </div>
      </div>
    );
  }

  if (!referralInfo) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <div className="p-4">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Gift className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400 text-lg mb-4">Could not load referral information</p>
            <button
              onClick={loadReferralInfo}
              className="px-6 py-3 bg-lime-500 hover:bg-lime-600 text-black rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalReferrals = (referralInfo.stats?.successfulReferrals || 0) + (referralInfo.stats?.pendingReferrals || 0);
  const totalEarned = referralInfo.stats?.totalEarned || 0;

  return (
    <div className="min-h-screen bg-dark-bg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Navigation */}
        <div className="mb-6">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-lime-500 rounded-full mb-4">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Referral Dashboard</h1>
          <p className="text-neutral-400 text-lg">Share the love and earn rewards!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-lime-500/20 rounded-xl">
                <Users className="w-6 h-6 text-lime-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-lime-400" />
            </div>
            <p className="text-neutral-400 text-sm font-medium mb-1">Total Referrals</p>
            <p className="text-4xl font-bold text-white">{totalReferrals}</p>
          </div>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-neutral-400 text-sm font-medium mb-1">Total Rewards</p>
            <p className="text-4xl font-bold text-emerald-400">${totalEarned.toFixed(2)}</p>
          </div>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-lime-500/20 rounded-xl">
                <Award className="w-6 h-6 text-lime-400" />
              </div>
            </div>
            <p className="text-neutral-400 text-sm font-medium mb-1">Avg per Referral</p>
            <p className="text-4xl font-bold text-lime-400">
              ${totalReferrals > 0 
                ? (totalEarned / totalReferrals).toFixed(2)
                : '0.00'}
            </p>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-3xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Gift className="w-8 h-8 text-lime-400" />
            Your Referral Code
          </h2>

          <div className="bg-dark-elevated rounded-2xl p-6 mb-6">
            <p className="text-neutral-400 text-sm mb-2">Referral Code</p>
            <div className="flex items-center gap-4">
              <code className="text-3xl font-bold tracking-wider text-white">{referralInfo.referralCode}</code>
              <button
                onClick={() => copyToClipboard(referralInfo.referralCode)}
                className="p-3 bg-lime-500/20 hover:bg-lime-500/30 rounded-xl transition-all text-lime-400"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="bg-dark-elevated rounded-2xl p-6 mb-6">
            <p className="text-neutral-400 text-sm mb-2">Referral Link</p>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={ourReferralUrl}
                readOnly
                className="input-dark flex-1 px-4 py-3 rounded-lg"
              />
              <button
                onClick={() => copyToClipboard(ourReferralUrl)}
                className="p-3 bg-lime-500/20 hover:bg-lime-500/30 rounded-xl transition-all text-lime-400"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={shareReferral}
            className="w-full py-4 bg-lime-500 hover:bg-lime-600 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
          >
            <Share2 className="w-6 h-6" />
            Share Referral Link
          </button>
        </div>

        <div className="bg-dark-card rounded-2xl border border-dark-border p-8">
          <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-lime-400">1</span>
              </div>
              <h3 className="font-bold text-white mb-2">Share Your Code</h3>
              <p className="text-neutral-400 text-sm">
                Share your unique referral code or link with friends and family
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-lime-400">2</span>
              </div>
              <h3 className="font-bold text-white mb-2">They Sign Up</h3>
              <p className="text-neutral-400 text-sm">
                When they sign up using your code, they get a welcome bonus
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-lime-400">3</span>
              </div>
              <h3 className="font-bold text-white mb-2">You Both Earn</h3>
              <p className="text-neutral-400 text-sm">
                Both you and your friend earn rewards on their first purchase
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-dark-elevated rounded-2xl border border-dark-border p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Why Share CardXC?</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="p-1 bg-lime-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-neutral-300">Earn rewards for every successful referral</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-lime-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-neutral-300">Help friends save money with cashback offers</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-lime-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-neutral-300">Unlimited referrals - no cap on earnings</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-lime-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-neutral-300">Track all your referrals in real-time</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
