import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const generateQR = async () => {
      try {
        setLoading(true);
        setError(false);
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (value) {
      generateQR();
    }
  }, [value, size]);

  if (loading) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !qrDataUrl) {
    return (
      <div 
        className="bg-slate-100 rounded-2xl flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="text-center">
          <i className="ri-error-warning-line text-3xl text-slate-400"></i>
          <p className="text-xs text-slate-500 mt-1">QR Error</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-lg inline-block">
      <img 
        src={qrDataUrl} 
        alt="QR Code" 
        width={size} 
        height={size}
        className="rounded-lg"
      />
    </div>
  );
}
