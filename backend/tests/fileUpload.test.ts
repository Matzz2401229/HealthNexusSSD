/**
 * File-upload validation tests (D1 §9.4). Confirms magic-byte checking and
 * double-extension rejection — the security-critical parts of the control.
 */
import { validateUpload } from '../src/middleware/fileUpload';

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_A_REAL_FILE = Buffer.from([0x00, 0x01, 0x02, 0x03]);

describe('validateUpload', () => {
  it('accepts a real PDF and assigns a UUID storage name', () => {
    const result = validateUpload('report.pdf', PDF);
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe('application/pdf');
    expect(result.storedName).toMatch(/\.pdf$/);
  });

  it('accepts a real PNG', () => {
    expect(validateUpload('scan.png', PNG).ok).toBe(true);
  });

  it('rejects a file whose content does not match an allowed type', () => {
    const result = validateUpload('evil.pdf', NOT_A_REAL_FILE);
    expect(result.ok).toBe(false);
  });

  it('rejects double extensions (report.pdf.exe)', () => {
    const result = validateUpload('report.pdf.exe', PDF);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/extension/i);
  });
});
