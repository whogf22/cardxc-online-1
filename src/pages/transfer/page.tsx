import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Step = 'amount' | 'review' | 'success';

interface Recipient {
  id: number;
  name: string;
  cardNumber: string;
}

export default function TransferPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('0');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedContact, setSelectedContact] = useState<Recipient | null>(null);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const userBalance = 56246.90;
  const txnId = `TXN ${Math.floor(Math.random() * 90000000) + 10000000}`;

  const handleAddRecipient = () => {
    if (recipientName.trim() && recipientAccount.trim()) {
      const newRecipient: Recipient = {
        id: Date.now(),
        name: recipientName.trim(),
        cardNumber: `**** ${recipientAccount.slice(-4)}`,
      };
      setRecipients(prev => [...prev, newRecipient]);
      setSelectedContact(newRecipient);
      setShowAddRecipient(false);
      setRecipientName('');
      setRecipientAccount('');
    }
  };

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setAmount(prev => prev.slice(0, -1) || '0');
    } else if (key === '.') {
      if (!amount.includes('.')) {
        setAmount(prev => prev + '.');
      }
    } else {
      if (amount === '0') {
        setAmount(key);
      } else {
        setAmount(prev => prev + key);
      }
    }
  };

  const handleContinue = () => {
    if (step === 'amount') {
      if (!selectedContact) {
        setShowAddRecipient(true);
        return;
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return;
      }
      setStep('review');
    } else if (step === 'review') {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep('success');
      }, 2000);
    }
  };

  const renderAddRecipientModal = () => {
    if (!showAddRecipient) return null;
    
    return (
      <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
        <div className="bg-dark-card border-t border-dark-border w-full max-w-md rounded-t-3xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Add Recipient</h2>
            <button
              onClick={() => setShowAddRecipient(false)}
              className="w-10 h-10 rounded-full hover:bg-dark-elevated flex items-center justify-center transition-colors"
            >
              <i className="ri-close-line text-xl text-neutral-400"></i>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Recipient Name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Enter recipient name"
                className="input-dark w-full rounded-xl px-4 py-3.5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Account Number
              </label>
              <input
                type="text"
                value={recipientAccount}
                onChange={(e) => setRecipientAccount(e.target.value)}
                placeholder="Enter account number"
                className="input-dark w-full rounded-xl px-4 py-3.5"
              />
            </div>
            
            <button
              onClick={handleAddRecipient}
              disabled={!recipientName.trim() || !recipientAccount.trim()}
              className="w-full py-4 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              Add Recipient
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderKeypad = () => (
    <div className="grid grid-cols-3 gap-4 mt-8">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
        <button
          key={key}
          onClick={() => handleKeyPress(key === 'backspace' ? 'backspace' : key)}
          className="h-16 flex items-center justify-center text-2xl font-medium text-white hover:bg-dark-elevated rounded-xl transition-colors border border-dark-border"
        >
          {key === 'backspace' ? (
            <i className="ri-delete-back-2-line text-neutral-400"></i>
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <div className="flex items-center justify-between px-6 pt-12 pb-4 bg-dark-card border-b border-dark-border">
          <div className="w-10"></div>
          <h1 className="text-lg font-semibold text-white">Transfer Complete</h1>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 flex flex-col px-6 pb-8">

          <div className="bg-dark-card rounded-3xl border border-dark-border p-8 mb-auto">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-lime-500/20 rounded-full flex items-center justify-center">
                <i className="ri-checkbox-circle-fill text-lime-400 text-5xl"></i>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white text-center mb-2">
              Transfer Success!
            </h3>
            <p className="text-neutral-400 text-center mb-8">
              Below is your withdraw summary
            </p>

            <div className="text-center mb-6">
              <p className="text-sm text-neutral-500 mb-2">Transfer Destination</p>
              <div className="flex items-center justify-center gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-lime-500/20 rounded-full flex items-center justify-center">
                    <i className="ri-user-fill text-lime-400"></i>
                  </div>
                  <span className="text-white font-medium">You</span>
                </div>
                <span className="text-neutral-500">To</span>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-lime-500/20 rounded-full flex items-center justify-center">
                    <i className="ri-user-fill text-lime-400"></i>
                  </div>
                  <span className="text-white font-medium">{selectedContact?.name.split(' ')[0]}</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-neutral-500 mb-1">Total Amount</p>
              <p className="text-4xl font-bold text-lime-400">${amount}</p>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-4 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <div className="flex items-center justify-between px-6 pt-12 pb-4 bg-dark-card border-b border-dark-border">
          <button
            onClick={() => setStep('amount')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-arrow-left-s-line text-xl text-neutral-300"></i>
          </button>
          <h1 className="text-lg font-semibold text-white">Review</h1>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 flex flex-col px-6 pb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white">Confirm To Transfer Money</h2>
          </div>

          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center">
                <i className="ri-user-fill text-lime-400 text-xl"></i>
              </div>
              <span className="text-white font-medium">You</span>
            </div>
            <span className="text-neutral-500">To</span>
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center">
                <i className="ri-user-fill text-lime-400 text-xl"></i>
              </div>
              <span className="text-white font-medium">{selectedContact?.name.split(' ')[0]}</span>
            </div>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Transaction ID</span>
              <span className="font-medium text-white">{txnId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Recipient</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-lime-500/20 rounded-full flex items-center justify-center">
                  <i className="ri-user-fill text-lime-400 text-xs"></i>
                </div>
                <span className="font-medium text-white">{selectedContact?.name.split(' ')[0]}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Amount</span>
              <span className="font-medium text-lime-400">${amount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Fees</span>
              <span className="font-medium text-white">$0.00</span>
            </div>
            <div className="border-t border-dark-border pt-4 flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Total Amount</span>
              <span className="font-bold text-lime-400 text-lg">${amount}</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-neutral-500 mb-2">Reference</label>
            <div className="flex items-center justify-between p-4 bg-dark-elevated border border-dark-border rounded-xl">
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Tap to add a note"
                maxLength={50}
                className="input-dark flex-1 bg-transparent border-0 p-0"
              />
              <span className="text-neutral-500 text-sm">{reference.length}/50</span>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full py-4 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-xl"></i>
                  Processing...
                </>
              ) : (
                'Confirm & Transfer'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <div className="flex items-center justify-between px-6 pt-12 pb-4 bg-dark-card border-b border-dark-border">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-dark-elevated transition-colors"
        >
          <i className="ri-arrow-left-s-line text-xl text-neutral-300"></i>
        </button>
        <h1 className="text-lg font-semibold text-white">Transfer</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8">
        <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
          <button 
            onClick={() => setShowAddRecipient(true)}
            className="flex-shrink-0 w-12 h-12 bg-lime-500 rounded-full flex items-center justify-center text-black font-semibold hover:bg-lime-400 transition-colors"
          >
            <i className="ri-add-line text-xl"></i>
          </button>
          {recipients.map((recipient, index) => (
            <button
              key={recipient.id}
              onClick={() => setSelectedContact(recipient)}
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                selectedContact?.id === recipient.id
                  ? 'ring-2 ring-lime-500 ring-offset-2 ring-offset-dark-bg'
                  : ''
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                ['bg-lime-500/20', 'bg-emerald-500/20', 'bg-amber-500/20', 'bg-sky-500/20', 'bg-purple-500/20'][index % 5]
              }`}>
                <span className={`text-lg font-semibold ${
                  ['text-lime-400', 'text-emerald-400', 'text-amber-400', 'text-sky-400', 'text-purple-400'][index % 5]
                }`}>
                  {recipient.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </button>
          ))}
          {recipients.length === 0 && (
            <span className="text-neutral-400 text-sm">Add recipient to transfer funds</span>
          )}
        </div>

        {selectedContact ? (
          <div className="flex items-center justify-between p-4 bg-dark-card border border-dark-border rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center">
                <i className="ri-user-fill text-lime-400 text-xl"></i>
              </div>
              <div>
                <p className="font-medium text-white">{selectedContact.name}</p>
                <p className="text-sm text-neutral-500">{selectedContact.cardNumber}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddRecipient(true)}
              className="px-4 py-2 bg-lime-500 text-black text-sm font-semibold rounded-full hover:bg-lime-400 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="p-6 bg-dark-card border border-dark-border rounded-xl mb-6 text-center">
            <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-user-add-line text-2xl text-neutral-500"></i>
            </div>
            <p className="font-medium text-white mb-1">No recipient selected</p>
            <p className="text-sm text-neutral-400 mb-4">Add a recipient to start your transfer</p>
            <button 
              onClick={() => setShowAddRecipient(true)}
              className="px-6 py-2 bg-lime-500 text-black text-sm font-semibold rounded-full hover:bg-lime-400 transition-colors"
            >
              Add Recipient
            </button>
          </div>
        )}

        <div className="text-center mb-4">
          <p className="text-5xl font-bold text-lime-400">${amount}</p>
          <p className="text-neutral-400 mt-2">Your Balance : ${userBalance.toLocaleString()} (Available)</p>
        </div>

        <button
          onClick={handleContinue}
          className="w-full py-4 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-xl transition-colors mb-4"
        >
          Continue
        </button>

        {renderKeypad()}
      </div>
      
      {renderAddRecipientModal()}
    </div>
  );
}
