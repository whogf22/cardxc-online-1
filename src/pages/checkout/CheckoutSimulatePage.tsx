import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Simulated checkout landing page.
 * When payment provider is not configured, the backend redirects users here.
 * Shows a short message and link back to wallet. Does not process real payments.
 */
export default function CheckoutSimulatePage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    // Optional: could poll order status or show "Simulated - no charge" based on id
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <i className="ri-bank-card-line text-3xl text-amber-600" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Simulated Checkout</h1>
        <p className="text-slate-600 mb-6">
          Payment provider is not configured in this environment. No charge will be made.
          Return to your wallet to use other deposit methods.
        </p>
        {id && (
          <p className="text-xs text-slate-400 mb-6 font-mono">Reference: {id}</p>
        )}
        <Link
          to="/wallet"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <i className="ri-wallet-3-line" aria-hidden />
          Back to Wallet
        </Link>
      </div>
    </div>
  );
}
