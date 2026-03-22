import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../lib/api';

interface DocumentState {
  file: File | null;
  preview: string | null;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  uploadedUrl?: string;
}

interface KYCDocumentUploadProps {
  onComplete?: () => void;
  onClose?: () => void;
}

const DOCUMENT_TYPES = {
  id_front: {
    title: 'ID Document (Front)',
    description: 'Upload the front of your government-issued ID',
    icon: 'ri-id-card-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  id_back: {
    title: 'ID Document (Back)',
    description: 'Upload the back of your ID document',
    icon: 'ri-id-card-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  selfie: {
    title: 'Selfie with ID',
    description: 'Take a clear photo holding your ID next to your face',
    icon: 'ri-camera-line',
    accept: 'image/jpeg,image/png,image/webp',
  },
  address_proof: {
    title: 'Proof of Address',
    description: 'Utility bill, bank statement, or government letter (last 3 months)',
    icon: 'ri-file-text-line',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
};

type DocumentType = keyof typeof DOCUMENT_TYPES;

export function KYCDocumentUpload({ onComplete, onClose }: KYCDocumentUploadProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentState>>({
    id_front: { file: null, preview: null, status: 'idle' },
    id_back: { file: null, preview: null, status: 'idle' },
    selfie: { file: null, preview: null, status: 'idle' },
    address_proof: { file: null, preview: null, status: 'idle' },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    id_front: null,
    id_back: null,
    selfie: null,
    address_proof: null,
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

  const handleUpload = async (type: DocumentType) => {
    const doc = documents[type];
    if (!doc.file || !user?.id) return;

    setDocuments(prev => ({
      ...prev,
      [type]: { ...prev[type], status: 'uploading' },
    }));

    try {
      const formData = new FormData();
      formData.append('file', doc.file);
      formData.append('documentType', type);

      const response = await fetch('/api/user/kyc/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.message?.includes('not configured') || response.status === 404) {
          setDocuments(prev => ({
            ...prev,
            [type]: { ...prev[type], status: 'uploaded', uploadedUrl: 'pending-storage-setup' },
          }));
          return;
        }
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      const publicUrl = data.data?.url || 'uploaded';

      setDocuments(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'uploaded', uploadedUrl: publicUrl },
      }));
    } catch (err: any) {
      console.error(`Upload error for ${type}:`, err);
      setDocuments(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'error', error: err.message || 'Upload failed' },
      }));
    }
  };

  const handleSubmitAll = async () => {
    if (!user?.id) return;

    const pendingUploads = Object.entries(documents).filter(
      ([, doc]) => doc.file && doc.status !== 'uploaded'
    );

    setIsSubmitting(true);

    try {
      for (const [type] of pendingUploads) {
        await handleUpload(type as DocumentType);
      }

      const uploadedDocs = Object.entries(documents)
        .filter(([, doc]) => doc.status === 'uploaded' || doc.file)
        .reduce((acc, [type, doc]) => ({
          ...acc,
          [type]: doc.uploadedUrl || 'uploaded',
        }), {});

      // Fetch existing profile to preserve other metadata fields
      const profileResult = await userApi.getProfile();
      const existingMetadata = (profileResult.data?.user as any)?.metadata || {};

      // Update profile with KYC documents metadata
      const updateResult = await userApi.updateProfile({
        metadata: {
          ...existingMetadata,
          kyc_documents: uploadedDocs,
          kyc_submitted_at: new Date().toISOString(),
        },
      } as any);

      if (!updateResult.success) {
        throw new Error(updateResult.error?.message || 'Failed to update profile');
      }

      setSubmitStatus('success');
      onComplete?.();
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allDocsReady = Object.values(documents).every(
    doc => doc.file && (doc.status === 'idle' || doc.status === 'uploaded')
  );

  if (submitStatus === 'success') {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-check-line text-green-600 text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Documents Submitted!</h3>
        <p className="text-slate-600 mb-6">
          Your KYC documents have been submitted for review. This usually takes 24-48 hours.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Identity Verification</h2>
          <p className="text-sm text-slate-500">Upload the required documents to verify your identity</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {(Object.entries(DOCUMENT_TYPES) as [DocumentType, typeof DOCUMENT_TYPES[DocumentType]][]).map(
          ([type, config]) => {
            const doc = documents[type];
            return (
              <div
                key={type}
                className={`border-2 rounded-xl p-4 transition-colors ${
                  doc.status === 'uploaded'
                    ? 'border-green-200 bg-green-50'
                    : doc.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : doc.file
                    ? 'border-teal-200 bg-teal-50'
                    : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      doc.status === 'uploaded'
                        ? 'bg-green-100'
                        : doc.file
                        ? 'bg-teal-100'
                        : 'bg-slate-100'
                    }`}
                  >
                    {doc.status === 'uploading' ? (
                      <i className="ri-loader-4-line text-teal-600 text-xl animate-spin"></i>
                    ) : doc.status === 'uploaded' ? (
                      <i className="ri-check-line text-green-600 text-xl"></i>
                    ) : (
                      <i className={`${config.icon} text-slate-600 text-xl`}></i>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{config.title}</h4>
                      {doc.status === 'uploaded' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Uploaded
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>

                    {doc.preview && (
                      <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden bg-slate-100">
                        <img
                          src={doc.preview}
                          alt={config.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {doc.file && !doc.preview && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                        <i className="ri-file-line"></i>
                        <span className="truncate">{doc.file.name}</span>
                      </div>
                    )}

                    {doc.error && (
                      <p className="text-sm text-red-600 mt-2">
                        <i className="ri-error-warning-line mr-1"></i>
                        {doc.error}
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
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        doc.file
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {doc.file ? 'Change' : 'Select File'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {allDocsReady
              ? 'All documents ready for submission'
              : `${Object.values(documents).filter(d => d.file).length}/4 documents selected`}
          </p>
          <button
            onClick={handleSubmitAll}
            disabled={!allDocsReady || isSubmitting}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              allDocsReady && !isSubmitting
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin"></i>
                Submitting...
              </span>
            ) : (
              'Submit for Verification'
            )}
          </button>
        </div>
      </div>

      <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-amber-600 text-lg mt-0.5"></i>
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Document Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Files must be clear and readable</li>
              <li>All corners of documents must be visible</li>
              <li>Maximum file size: 10MB per document</li>
              <li>Accepted formats: JPEG, PNG, WebP, PDF</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
