import { useState } from 'react';
import { CreditCard, Plus, Trash2, Download, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { adminApi } from '../../../lib/api';

interface BulkCardInput {
  spendLimit: number;
  spendLimitDuration: 'TRANSACTION' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL_TIME';
  cardholderName: string;
}

export default function BulkCardCreatorTab() {
  const [cards, setCards] = useState<BulkCardInput[]>([{
    spendLimit: 50,
    spendLimitDuration: 'MONTHLY',
    cardholderName: ''
  }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addCard = () => {
    if (cards.length < 50) {
      setCards([...cards, {
        spendLimit: 50,
        spendLimitDuration: 'MONTHLY',
        cardholderName: ''
      }]);
    }
  };

  const removeCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, field: keyof BulkCardInput, value: any) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], [field]: value };
    setCards(updated);
  };

  const handleBulkCreate = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await adminApi.bulkCreateVirtualCards(cards);
      setResult({
        success: true,
        data: response
      });

      alert(`Successfully created ${response.data?.total ?? cards.length} virtual cards!`);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data?.error || 'Failed to create cards'
      });
      alert('Failed to create cards: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const exportTemplate = () => {
    const csv = [
      ['Cardholder Name', 'Spend Limit', 'Limit Duration'],
      ...Array(10).fill(0).map((_, i) => [
        `Cardholder ${i + 1}`,
        '50',
        'MONTHLY'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-cards-template.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <CreditCard className="w-8 h-8" />
              Bulk Virtual Card Creator
            </h2>
            <p className="text-white/90">Create 1-50 virtual cards at once</p>
          </div>
          <button
            onClick={exportTemplate}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            CSV Template
          </button>
        </div>
      </div>

      {/* Alert */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">Admin Only Feature</p>
            <p className="text-sm text-yellow-700">This feature requires super admin permissions. Maximum 50 cards per bulk operation.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-1">Cards to Create</p>
          <p className="text-3xl font-bold text-gray-900">{cards.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-1">Total Limit</p>
          <p className="text-3xl font-bold text-blue-600">
            ${cards.reduce((sum, card) => sum + card.spendLimit, 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-1">Avg Limit</p>
          <p className="text-3xl font-bold text-green-600">
            ${(cards.reduce((sum, card) => sum + card.spendLimit, 0) / cards.length).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Card List */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Card Details</h3>
          <button
            onClick={addCard}
            disabled={cards.length >= 50}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Card ({cards.length}/50)
          </button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {cards.map((card, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                  #{index + 1}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={card.cardholderName}
                      onChange={(e) => updateCard(index, 'cardholderName', e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spend Limit ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={card.spendLimit}
                      onChange={(e) => updateCard(index, 'spendLimit', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <select
                      value={card.spendLimitDuration}
                      onChange={(e) => updateCard(index, 'spendLimitDuration', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="TRANSACTION">Per Transaction</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                      <option value="ALL_TIME">All Time</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => removeCard(index)}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  disabled={cards.length === 1}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleBulkCreate}
          disabled={loading || cards.length === 0}
          className="flex-1 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader className="w-6 h-6 animate-spin" />
              Creating Cards...
            </>
          ) : (
            <>
              <CreditCard className="w-6 h-6" />
              Create {cards.length} Card{cards.length > 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-2xl p-6 ${
          result.success ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'
        }`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-bold text-lg mb-2 ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {result.success ? 'Success!' : 'Error'}
              </h3>
              {result.success ? (
                <div>
                  <p className="text-green-800 mb-3">
                    Successfully created {result.data.total} virtual cards!
                  </p>
                  <div className="bg-white rounded-lg p-4 space-y-2">
                    {result.data.cards.slice(0, 5).map((card: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-mono">**** {card.last4}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          card.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {card.status}
                        </span>
                      </div>
                    ))}
                    {result.data.cards.length > 5 && (
                      <p className="text-gray-600 text-center pt-2">
                        ... and {result.data.cards.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-red-800">{result.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
