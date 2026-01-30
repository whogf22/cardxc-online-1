import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../../../components/BottomNavigation';

export default function PaymentsInformationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 flex items-center justify-center"
          >
            <i className="ri-arrow-left-s-line text-2xl text-gray-800"></i>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Payments Information</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 p-4">
          <div className="text-center py-8">
            <i className="ri-bank-card-line text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-500">No payment methods added yet</p>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
