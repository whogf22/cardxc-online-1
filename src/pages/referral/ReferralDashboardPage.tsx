import { useState, useEffect } from 'react';
import { Gift, Users, DollarSign, Copy, Share2, TrendingUp, Award, Check, ExternalLink } from 'lucide-react';
import { userApi } from '../../lib/api';

interface FluzReferralInfo {
  referralCode: string;
  referralUrl: string;
  totalReferrals: number;
  totalRewards: number;
}

export default function ReferralDashboardPage() {
  const [referralInfo, setReferralInfo] = useState<FluzReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    try {
      setLoading(true);
      const response = await userApi.getFluzReferralInfo();
      setReferralInfo(response.referral);
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

  const shareReferral = async () => {
    if (!referralInfo) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CardXC with Fluz!',
          text: `Use my referral code ${referralInfo.referralCode} to get amazing cashback on gift cards!`,
          url: referralInfo.referralUrl
        });
      } catch (error) {
        console.log('Share canceled');
      }
    } else {
      copyToClipboard(referralInfo.referralUrl);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading referral dashboard...</p>
        </div>
      </div>
    );
  }

  if (!referralInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Failed to load referral information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mb-4">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Referral Dashboard</h1>
          <p className="text-gray-600 text-lg">Share the love and earn rewards!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Referrals</p>
            <p className="text-4xl font-bold text-gray-900">{referralInfo.totalReferrals}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Rewards</p>
            <p className="text-4xl font-bold text-green-600">${referralInfo.totalRewards.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">Avg per Referral</p>
            <p className="text-4xl font-bold text-blue-600">
              ${referralInfo.totalReferrals > 0 
                ? (referralInfo.totalRewards / referralInfo.totalReferrals).toFixed(2)
                : '0.00'}
            </p>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl shadow-2xl p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Gift className="w-8 h-8" />
            Your Referral Code
          </h2>

          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <p className="text-white/80 text-sm mb-2">Referral Code</p>
            <div className="flex items-center gap-4">
              <code className="text-3xl font-bold tracking-wider">{referralInfo.referralCode}</code>
              <button
                onClick={() => copyToClipboard(referralInfo.referralCode)}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <p className="text-white/80 text-sm mb-2">Referral Link</p>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={referralInfo.referralUrl}
                readOnly
                className="flex-1 bg-white/10 px-4 py-3 rounded-lg text-white placeholder-white/50 border border-white/20 focus:outline-none focus:border-white/40"
              />
              <button
                onClick={() => copyToClipboard(referralInfo.referralUrl)}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={shareReferral}
            className="w-full py-4 bg-white text-purple-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-lg"
          >
            <Share2 className="w-6 h-6" />
            Share Referral Link
          </button>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">1</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Share Your Code</h3>
              <p className="text-gray-600 text-sm">
                Share your unique referral code or link with friends and family
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">They Sign Up</h3>
              <p className="text-gray-600 text-sm">
                When they sign up using your code, they get a welcome bonus
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">3</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">You Both Earn</h3>
              <p className="text-gray-600 text-sm">
                Both you and your friend earn rewards on their first purchase
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Share CardXC?</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="p-1 bg-green-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Earn rewards for every successful referral</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-green-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Help friends save money with cashback offers</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-green-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Unlimited referrals - no cap on earnings</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 bg-green-500 rounded-full mt-1">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Track all your referrals in real-time</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
