/**
 * Content-based file type detection via magic bytes.
 *
 * Declared MIME types and file extensions are attacker-controlled, so uploads
 * (e.g. KYC documents) must be validated against their actual byte signature to
 * prevent MIME spoofing (uploading an executable/HTML with an image MIME).
 */

export type DetectedFileType = 'jpeg' | 'png' | 'webp' | 'pdf';

/**
 * Detect a supported file type from the leading bytes of a file.
 * Returns null when the signature does not match a supported type.
 */
export function detectFileType(head: Buffer): DetectedFileType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'jpeg';
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return 'png';
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    head.length >= 12 &&
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  // PDF: "%PDF-"
  if (head.length >= 5 && head.toString('ascii', 0, 5) === '%PDF-') {
    return 'pdf';
  }
  return null;
}

/** MIME types permitted for KYC documents, mapped to their detected type. */
const KYC_MIME_TO_TYPE: Record<string, DetectedFileType> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Validate that a KYC upload's real content matches an allowed type AND the
 * declared MIME type. Returns the detected type, or null if invalid.
 */
export function validateKycFileContent(head: Buffer, declaredMime: string): DetectedFileType | null {
  const detected = detectFileType(head);
  if (!detected) return null;
  const expected = KYC_MIME_TO_TYPE[declaredMime];
  if (!expected || expected !== detected) return null;
  return detected;
}
