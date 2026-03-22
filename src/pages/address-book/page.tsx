import { useNavigate } from 'react-router-dom';
import AddressBook from '../../components/AddressBook';

export default function AddressBookPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full hover:bg-dark-elevated flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-xl text-neutral-300"></i>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Address Book</h1>
                <p className="text-sm text-neutral-500">Manage your saved crypto addresses</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="flex items-center space-x-2 px-4 py-2 bg-dark-elevated hover:bg-lime-500/20 text-lime-400 font-medium rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-wallet-3-line"></i>
              <span className="hidden sm:inline">Back to Wallet</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
          <AddressBook />
        </div>

        <div className="mt-6 p-4 bg-dark-elevated rounded-xl border border-dark-border">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-white"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Secure Address Management</p>
              <p className="text-xs text-neutral-400">
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
