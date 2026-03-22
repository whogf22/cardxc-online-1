import { useNavigate } from 'react-router-dom';

export default function PaymentsInformationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      <div className="bg-dark-card px-4 pt-12 pb-4 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-arrow-left-s-line text-2xl text-neutral-300"></i>
          </button>
          <h1 className="text-xl font-semibold text-white">Payments Information</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border p-4">
          <div className="text-center py-8">
            <i className="ri-bank-card-line text-4xl text-neutral-600 mb-3"></i>
            <p className="text-neutral-500">No payment methods added yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
