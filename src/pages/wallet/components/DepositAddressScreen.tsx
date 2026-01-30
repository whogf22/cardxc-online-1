import { useState } from 'react';
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

export default function DepositAddressScreen({ asset, networks, onBack }: DepositAddressScreenProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const networkData = networks.find(n => n.id === selectedNetwork);
  const address = networkData?.depositAddress || '';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-line text-xl text-slate-600"></i>
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Deposit {asset}</h2>
          <p className="text-sm text-slate-500">Select network and scan QR code</p>
        </div>
      </div>

      <NetworkSelector
        networks={networks}
        selectedNetwork={selectedNetwork}
        onSelect={setSelectedNetwork}
      />

      {networkData && (
        <>
          <div className="flex justify-center py-4">
            <QRCodeDisplay value={address} size={180} />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Deposit Address ({networkData.name})
            </label>
            <div className="relative">
              <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl pr-12">
                <p className="text-sm font-mono text-slate-800 break-all leading-relaxed">
                  {address}
                </p>
              </div>
              <button
                onClick={handleCopyAddress}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-white text-lg`}></i>
              </button>
            </div>
            {copied && (
              <p className="text-sm text-emerald-600 font-medium flex items-center space-x-1">
                <i className="ri-check-double-line"></i>
                <span>Address copied to clipboard!</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyAddress}
              className="flex items-center justify-center space-x-2 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-file-copy-line text-slate-700"></i>
              <span className="font-medium text-slate-700">Copy</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center space-x-2 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-share-line text-slate-700"></i>
              <span className="font-medium text-slate-700">Share</span>
            </button>
          </div>

          {showShareOptions && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 mb-3">Share via:</p>
              <div className="flex space-x-3">
                <a
                  href={`mailto:?subject=${encodeURIComponent(`${asset} Deposit Address`)}&body=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address: ${address}`)}`}
                  className="flex-1 p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-mail-line text-slate-600"></i>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address: ${address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-whatsapp-line text-green-600"></i>
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(address)}&text=${encodeURIComponent(`My ${asset} (${networkData.name}) deposit address`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <i className="ri-telegram-line text-blue-500"></i>
                </a>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-blue-600 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-blue-800">Minimum Deposit</p>
                  <p className="text-sm text-blue-700 mt-1">{networkData.minDeposit}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <i className="ri-time-line text-slate-600 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-slate-800">Confirmation Time</p>
                  <p className="text-sm text-slate-600 mt-1">
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
