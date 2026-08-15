/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { detectFileType, validateKycFileContent } from '../fileSignature';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
const pdf = Buffer.from('%PDF-1.7\n');
const html = Buffer.from('<html><script>alert(1)</script>');

describe('detectFileType', () => {
  it('detects jpeg/png/webp/pdf by magic bytes', () => {
    expect(detectFileType(jpeg)).toBe('jpeg');
    expect(detectFileType(png)).toBe('png');
    expect(detectFileType(webp)).toBe('webp');
    expect(detectFileType(pdf)).toBe('pdf');
  });
  it('returns null for unknown/spoofed content', () => {
    expect(detectFileType(html)).toBeNull();
    expect(detectFileType(Buffer.from([0x00, 0x01]))).toBeNull();
  });
});

describe('validateKycFileContent', () => {
  it('accepts content that matches the declared MIME', () => {
    expect(validateKycFileContent(png, 'image/png')).toBe('png');
    expect(validateKycFileContent(pdf, 'application/pdf')).toBe('pdf');
  });
  it('rejects a MIME/content mismatch (spoofing)', () => {
    expect(validateKycFileContent(html, 'image/png')).toBeNull();
    expect(validateKycFileContent(jpeg, 'application/pdf')).toBeNull();
  });
  it('rejects a disallowed declared MIME even with valid content', () => {
    expect(validateKycFileContent(jpeg, 'image/gif')).toBeNull();
  });
});
