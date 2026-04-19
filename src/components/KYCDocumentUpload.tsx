import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

interface DocumentState {
  file: File | null;
  preview: string | null;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

interface KYCDocumentUploadProps {
  onComplete?: () => void;
  onClose?: () => void;
}

const DOCUMENT_TYPES = {
  passport: {
    title: 'Passport',
    description: 'Upload a clear photo of your passport bio page',
    icon: 'ri-passport-line',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  national_id: {
    title: 'National ID Card',
    description: 'Upload front of your government-issued national ID',
    icon: 'ri-id-card-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  drivers_license: {
    title: "Driver's License",
    description: 'Upload front of your valid driving license',
    icon: 'ri-steering-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  selfie: {
    title: 'Selfie with ID',
    description: 'Take a clear photo holding your ID next to your face',
    icon: 'ri-camera-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  proof_of_address: {
    title: 'Proof of Address',
    description: 'Utility bill, bank statement, or government letter (last 3 months)',
    icon: 'ri-file-text-line',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
};

type DocumentType = keyof typeof DOCUMENT_TYPES;

// Minimum required: one ID document + selfie
const _REQUIRED_DOCS: DocumentType[] = ['selfie'];
const ID_DOCS: DocumentType[] = ['passport', 'national_id', 'drivers_license'];

export function KYCDocumentUpload({ onComplete, onClose }: KYCDocumentUploadProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentState>>({
    passport: { file: null, preview: null, status: 'idle' },
    national_id: { file: null, preview: null, status: 'idle' },
    drivers_license: { file: null, preview: null, status: 'idle' },
    selfie: { file: null, preview: null, status: 'idle' },
    proof_of_address: { file: null, preview: null, status: 'idle' },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const fileInputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    passport: null,
    national_id: null,
    drivers_license: null,
    selfie: null,
    proof_of_address: null,
  });

  const handleFileSelect = useCallback((type: DocumentType, file: File | null) => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setDocuments(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'error', error: 'File size must be under 10MB' },
      }));
      return;
    }

    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setDocuments(prev => ({
      ...prev,
      [type]: { file, preview, status: 'idle', error: undefined },
    }));
  }, []);

  const uploadDocument = async (type: DocumentType): Promise<boolean> => {
    const doc = documents[type];
    if (!doc.file) return false;

    setDocuments(prev => ({
      ...prev,
      [type]: { ...prev[type], status: 'uploading' },
    }));

    try {
      const formData = new FormData();
      formData.append('document', doc.file);
      formData.append('documentType', type);

      const response = await fetch('/api/user/kyc/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      setDocuments(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'uploaded' },
      }));
      return true;
    } catch (err: any) {
      console.error(`Upload error for ${type}:`, err);
      setDocuments(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'error', error: err.message || 'Upload failed' },
      }));
      return false;
    }
  };

  const handleSubmitAll = async () => {
    if (!user?.id) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const docsToUpload = Object.entries(documents).filter(
        ([, doc]) => doc.file && doc.status !== 'uploaded'
      );

      let allSuccess = true;
      for (const [type] of docsToUpload) {
        const success = await uploadDocument(type as DocumentType);
        if (!success) allSuccess = false;
      }

      if (allSuccess) {
        setSubmitStatus('success');
        onComplete?.();
      } else {
        setSubmitError('Some documents failed to upload. Please try again.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check readiness: at least 1 ID doc + selfie
  const hasIdDoc = ID_DOCS.some(type => documents[type].file);
  const hasSelfie = documents.selfie.file !== null;
  const selectedCount = Object.values(documents).filter(d => d.file).length;
  const isReady = hasIdDoc && hasSelfie;

  if (submitStatus === 'success') {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center border border-green-500/30">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-check-line text-green-400 text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Documents Submitted!</h3>
        <p className="text-gray-400 mb-6">
          Your KYC documents have been submitted for review. This usually takes 24-48 hours.
          You will be notified once your verification is complete.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:from-violet-500 hover:to-indigo-500 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden border border-white/10">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Identity Verification</h2>
          <p className="text-sm text-gray-400">Upload documents to verify your identity</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <i className="ri-close-line text-gray-400 text-xl"></i>
          </button>
        )}
      </div>

      {/* Required info */}
      <div className="px-6 pt-4">
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-start gap-3">
          <i className="ri-information-line text-violet-400 text-lg mt-0.5"></i>
          <div className="text-sm text-violet-300">
            <p className="font-medium">Required: At least 1 ID document + Selfie with ID</p>
            <p className="text-violet-400/70 text-xs mt-1">Proof of address is optional but recommended</p>
          </div>
        </div>
      </div>

      {/* Document upload cards */}
      <div className="p-6 space-y-3">
        {(Object.entries(DOCUMENT_TYPES) as [DocumentType, typeof DOCUMENT_TYPES[DocumentType]][]).map(
          ([type, config]) => {
            const doc = documents[type];
            const isRequired = type === 'selfie' || ID_DOCS.includes(type as DocumentType);
            return (
              <div
                key={type}
                className={`border rounded-xl p-4 transition-all duration-200 ${
                  doc.status === 'uploaded'
                    ? 'border-green-500/40 bg-green-500/5'
                    : doc.status === 'error'
                    ? 'border-red-500/40 bg-red-500/5'
                    : doc.file
                    ? 'border-violet-500/40 bg-violet-500/5'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      doc.status === 'uploaded'
                        ? 'bg-green-500/20'
                        : doc.file
                        ? 'bg-violet-500/20'
                        : 'bg-white/5'
                    }`}
                  >
                    {doc.status === 'uploading' ? (
                      <i className="ri-loader-4-line text-violet-400 text-lg animate-spin"></i>
                    ) : doc.status === 'uploaded' ? (
                      <i className="ri-check-line text-green-400 text-lg"></i>
                    ) : (
                      <i className={`${config.icon} text-gray-400 text-lg`}></i>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white text-sm">{config.title}</h4>
                      {isRequired && type === 'selfie' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Required</span>
                      )}
                      {doc.status === 'uploaded' && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Uploaded</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>

                    {doc.preview && (
                      <div className="mt-2 relative w-16 h-16 rounded-lg overflow-hidden bg-white/5">
                        <img src={doc.preview} alt={config.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {doc.file && !doc.preview && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                        <i className="ri-file-line"></i>
                        <span className="truncate">{doc.file.name}</span>
                      </div>
                    )}

                    {doc.error && (
                      <p className="text-xs text-red-400 mt-1.5">
                        <i className="ri-error-warning-line mr-1"></i>{doc.error}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    <input
                      ref={el => { fileInputRefs.current[type] = el; }}
                      type="file"
                      accept={config.accept}
                      onChange={e => handleFileSelect(type, e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRefs.current[type]?.click()}
                      disabled={doc.status === 'uploading'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        doc.file
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                          : 'bg-violet-600/80 text-white hover:bg-violet-600 border border-violet-500/50'
                      }`}
                    >
                      {doc.file ? 'Change' : 'Select'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Submit footer */}
      <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
        {submitError && (
          <p className="text-xs text-red-400 mb-3">
            <i className="ri-error-warning-line mr-1"></i>{submitError}
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {isReady
              ? `${selectedCount} document${selectedCount > 1 ? 's' : ''} ready for submission`
              : !hasIdDoc
              ? 'Select at least one ID document'
              : 'Selfie with ID is required'}
          </p>
          <button
            onClick={handleSubmitAll}
            disabled={!isReady || isSubmitting}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              isReady && !isSubmitting
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20'
                : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin"></i>
                Uploading...
              </span>
            ) : (
              'Submit for Verification'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
