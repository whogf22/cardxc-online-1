import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';

const API_BASE = import.meta.env?.VITE_API_URL || '/api';

export default function SupportPage() {
  const navigate = useNavigate();
  const [supportEmail, setSupportEmail] = useState<string>('support@cardxc.online');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchSupportContact();
  }, [authChecked]);

  const checkAuth = async () => {
    try {
      const result = await authApi.getSession();
      if (!result.success || !result.data?.user) {
        navigate('/signin');
        return;
      }
      setAuthChecked(true);
    } catch {
      navigate('/signin');
    }
  };

  const fetchSupportContact = async () => {
    try {
      const res = await fetch(`${API_BASE}/support/contact`, { credentials: 'include' });
      const data = await res.json();
      if (data?.success && data?.data?.supportEmail) {
        setSupportEmail(data.data.supportEmail);
      }
    } catch {
      // Keep default supportEmail
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      <div className="bg-dark-card border-b border-dark-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-semibold text-white">Support</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-lime-500/20 rounded-full flex items-center justify-center">
            <i className="ri-customer-service-2-line text-3xl text-lime-400"></i>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Contact us</h2>
          <p className="text-neutral-400 mb-4">
            Need help? Email us and we&apos;ll get back to you as soon as we can.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-lime-500 text-black font-semibold rounded-xl hover:bg-lime-400 transition-colors"
          >
            <i className="ri-mail-line"></i>
            {supportEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
