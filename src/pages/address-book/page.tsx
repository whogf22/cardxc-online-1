import { useNavigate } from 'react-router-dom';
import AddressBook from '../../components/AddressBook';

export default function AddressBookPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-xl text-slate-600"></i>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Address Book</h1>
                <p className="text-sm text-slate-500">Manage your saved crypto addresses</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-wallet-3-line"></i>
              <span className="hidden sm:inline">Back to Wallet</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <AddressBook />
        </div>

        <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-white"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-1">Secure Address Management</p>
              <p className="text-xs text-slate-600">
                Save frequently used wallet addresses for quick and secure withdrawals. 
                Always verify addresses before sending cryptocurrency as transactions are irreversible.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
