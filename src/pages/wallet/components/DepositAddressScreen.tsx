import { useState, useEffect, useRef } from 'react';
import QRCodeDisplay from './QRCodeDisplay';
import NetworkSelector from './NetworkSelector';

interface Network {
  id: string;
  name: string;
  fullName: string;
  icon: string;
  fee: string;
  confirmations: number;
  minDeposit: string;
  depositAddress: string;
}

interface DepositAddressScreenProps {
  asset: string;
  networks: Network[];
  onBack: () => void;
}

type DepositStep = 'address' | 'tracking';

export default function DepositAddressScreen({ asset, networks, onBack }: DepositAddressScreenProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [step, setStep] = useState<DepositStep>('address');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStatus, setDepositStatus] = useState<string>('pending');
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [depositConfirmations, setDepositConfirmations] = useState(0);
  const [depositError, setDepositError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [senderAddress, setSenderAddress] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const networkData = networks.find(n => n.id === selectedNetwork);
  const address = networkData?.depositAddress || '';
  const isTRC20 = selectedNetwork.includes('trc20');

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${asset} Deposit Address`,
          text: `My ${asset} (${networkData?.name}) deposit address: ${address}`
        });
      } catch (err) {
        console.error('Share failed:', err);
        setShowShareOptions(true);
      }
    } else {
      setShowShareOptions(true);
    }
  };

  const handleCreateDepositIntent = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setDepositError('Please enter a valid amount');
      return;
    }
    if (!senderAddress || !senderAddress.startsWith('T') || senderAddress.length !== 34) {
      setDepositError('Please enter your TronLink wallet address (starts with T, 34 characters)');
      return;
    }

    setIsCreating(true);
    setDepositError('');

    try {
      const { userApi } = await import('../../../lib/api');
      const result = await userApi.createDepositIntent({
        amount: parseFloat(depositAmount),
        fromAddress: senderAddress.trim(),
      });

      if (result.success && result.data) {
        setStep('tracking');
        startPolling(result.data.depositId);
      } else {
        setDepositError(result.error?.message || 'Failed to create deposit intent');
      }
    } catch (err: any) {
      setDepositError(err.message || 'Failed to create deposit intent');
    } finally {
      setIsCreating(false);
    }
  };

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const { userApi } = await import('../../../lib/api');
        const result = await userApi.getDepositStatus(id);
        if (result.success && result.data) {
          setDepositStatus(result.data.status);
          setDepositTxHash(result.data.tx_hash);
          setDepositConfirmations(result.data.confirmations || 0);

          if (result.data.status === 'completed' || result.data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // silently retry
      }
    }, 10000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-lime-400';
      case 'confirming': return 'text-amber-400';
      case 'failed': return 'text-red-400';
      default: return 'text-white/60';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'ri-check-double-line';
      case 'confirming': return 'ri-loader-4-line animate-spin';
      case 'failed': return 'ri-close-circle-line';
      default: return 'ri-time-line';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Deposit Confirmed';
      case 'confirming': return 'Waiting for Confirmations';
      case 'failed': return 'Deposit Failed';
      case 'expired': return 'Deposit Expired';
      default: return 'Waiting for Deposit';
    }
  };

  if (step === 'tracking') {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (pollRef.current) clearInterval(pollRef.current);
              setStep('address');
            }}
            className="w-10 h-10 rounded-full hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line text-xl text-white/60"></i>
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Tracking Deposit</h2>
            <p className="text-sm text-white/50">{depositAmount} {asset} via {networkData?.name}</p>
          </div>
        </div>

        <div className="text-center py-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            depositStatus === 'completed' ? 'bg-lime-500/[0.12]' : 
            depositStatus === 'failed' ? 'bg-red-500/[0.12]' : 'bg-white/[0.06]'
          }`}>
            <i className={`${getStatusIcon(depositStatus)} text-3xl ${getStatusColor(depositStatus)}`}></i>
          </div>
          <h3 className={`text-lg font-bold ${getStatusColor(depositStatus)}`}>
            {getStatusText(depositStatus)}
          </h3>
          <p className="text-sm text-white/50 mt-2">
            {depositStatus === 'pending' && 'Send the exact amount to the address below. We\'ll detect it automatically.'}
            {depositStatus === 'confirming' && `${depositConfirmations}/${networkData?.confirmations || 20} confirmations`}
            {depositStatus === 'completed' && 'Your wallet has been credited.'}
            {depositStatus === 'failed' && 'Please try again or contact support.'}
          </p>
        </div>

        {depositStatus === 'pending' && address && (
          <>
            <div className="flex justify-center py-2">
              <QRCodeDisplay value={address} size={140} />
            </div>
            <div className="relative">
              <div className="p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl pr-12">
                <p className="text-xs font-mono text-white/80 break-all leading-relaxed">
                  {address}
                </p>
              </div>
              <button
                onClick={handleCopyAddress}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-lime-500 hover:bg-lime-600 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-white text-sm`}></i>
              </button>
            </div>
          </>
        )}

        {depositTxHash && (
          <div className="p-4 bg-white/[0.04] rounded-xl border border-white/[0.08]">
            <p className="text-xs text-white/50 mb-1">Transaction Hash</p>
            <a
              href={`https://tronscan.org/#/transaction/${depositTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-lime-400 break-all hover:text-lime-300 cursor-pointer"
            >
              {depositTxHash}
            </a>
          </div>
        )}

        <div className="p-4 bg-white/[0.04] rounded-xl border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Amount</span>
            <span className="text-sm font-semibold text-white">{depositAmount} {asset}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Network</span>
            <span className="text-sm font-semibold text-white">{networkData?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Status</span>
            <span className={`text-sm font-semibold ${getStatusColor(depositStatus)}`}>
              {getStatusText(depositStatus)}
            </span>
          </div>
        </div>

        {depositStatus === 'pending' && (
          <div className="p-4 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
            <div className="flex items-start space-x-3">
              <i className="ri-information-line text-amber-400 text-lg mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-amber-300">Important</p>
                <p className="text-xs text-amber-300/80 mt-1">
                  Send exactly {depositAmount} {asset} via {networkData?.name} network only.
                  Deposits are auto-detected within 2-5 minutes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-line text-xl text-white/60"></i>
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">Deposit {asset}</h2>
          <p className="text-sm text-white/50">Select network and scan QR code</p>
        </div>
      </div>

      <NetworkSelector
        networks={networks}
        selectedNetwork={selectedNetwork}
        onSelect={setSelectedNetwork}
      />

      {networkData && !address && (
        <div className="text-center py-8 px-4">
          <div className="w-16 h-16 bg-amber-500/[0.12] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-time-line text-3xl text-amber-400"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Coming Soon</h3>
          <p className="text-sm text-white/50">Crypto deposit addresses are being configured. Please check back later or use fiat deposit instead.</p>
        </div>
      )}

      {networkData && address && (
        <>
          <div className="flex justify-center py-4">
            <QRCodeDisplay value={address} size={180} />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-white/80">
              Deposit Address ({networkData.name})
            </label>
            <div className="relative">
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl pr-12">
                <p className="text-sm font-mono text-white/80 break-all leading-relaxed">
                  {address}
                </p>
              </div>
              <button
                onClick={handleCopyAddress}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-lime-500 hover:bg-lime-600 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-white text-lg`}></i>
              </button>
            </div>
            {copied && (
              <p className="text-sm text-lime-400 font-medium flex items-center space-x-1">
                <i className="ri-check-double-line"></i>
                <span>Address copied to clipboard!</span>
              </p>
            )}
          </div>

          {isTRC20 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white/80">
                Your TronLink Wallet Address
              </label>
              <input
                type="text"
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                placeholder="T... (your sending address)"
                className="w-full px-4 py-3 text-sm font-mono border border-white/[0.08] rounded-xl bg-white/[0.04] text-white focus:border-lime-500 focus:outline-none transition-colors"
              />

              <label className="block text-sm font-semibold text-white/80">
                Deposit Amount ({asset})
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="0.01"
                className="w-full px-4 py-4 text-lg font-bold border border-white/[0.08] rounded-xl bg-white/[0.04] text-white focus:border-lime-500 focus:outline-none transition-colors"
              />

              {depositError && (
                <div className="p-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{depositError}</p>
                </div>
              )}

              <button
                onClick={handleCreateDepositIntent}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || !senderAddress || isCreating}
                className="w-full py-4 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 disabled:from-white/20 disabled:to-white/10 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-lime-500/30 flex items-center justify-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line"></i>
                    <span>I've Sent the Deposit</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyAddress}
              className="flex items-center justify-center space-x-2 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-file-copy-line text-white/80"></i>
              <span className="font-medium text-white/80">Copy</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center space-x-2 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-share-line text-white/80"></i>
              <span className="font-medium text-white/80">Share</span>
            </button>
          </div>

          {showShareOptions && (
            <div className="p-4 bg-white/[0.04] rounded-xl border border-white/[0.08]">
              <p className="text-sm text-white/60 mb-3">Share via:</p>
              <div className="flex space-x-3">
                <a
                  href={`mailto:?subject=${encodeURIComponent(`${asset} Deposit Address`)}&body=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address: ${address}`)}`}
                  className="flex-1 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/[0.08] flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-mail-line text-white/60"></i>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address: ${address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/[0.08] flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-whatsapp-line text-green-400"></i>
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(address)}&text=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/[0.08] flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-telegram-line text-blue-400"></i>
                </a>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="p-4 bg-blue-500/[0.08] border border-blue-500/20 rounded-xl">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-blue-400 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-blue-300">Minimum Deposit</p>
                  <p className="text-sm text-blue-300/80 mt-1">{networkData.minDeposit}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
              <div className="flex items-start space-x-3">
                <i className="ri-time-line text-white/60 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-white">Confirmation Time</p>
                  <p className="text-sm text-white/60 mt-1">
                    {networkData.confirmations} network confirmations required
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}