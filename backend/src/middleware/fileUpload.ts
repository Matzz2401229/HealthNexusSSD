/**
 * Secure file upload validation (D1 §9.4, FSR10, SDR7).
 * - Allowlist MIME: pdf / jpeg / png
 * - Verify MAGIC BYTES independent of the client-supplied Content-Type
 * - Reject double extensions (report.pdf.exe) and dangerous types
 * - Max 10 MB; store under a random UUID OUTSIDE the web root
 * - Serve only via authenticated, ownership-checked endpoints
 *
 * SKELETON: this validates a buffer. Wire it to the upload route + storage.
 */
import crypto from 'crypto';
import path from 'path';
import { config } from '../config/env';

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

// Leading magic-byte signatures (checked against file content, not headers).
const MAGIC: Record<AllowedMime, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

const EXT_FOR: Record<AllowedMime, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export interface UploadCheckResult {
  ok: boolean;
  reason?: string;
  detectedMime?: AllowedMime;
  storedName?: string;
}

/** Validate size, magic bytes, and filename; return a random UUID storage name. */
export function validateUpload(originalName: string, buffer: Buffer): UploadCheckResult {
  if (buffer.length > config.upload.maxBytes) {
    return { ok: false, reason: 'File exceeds 10 MB limit.' };
  }

  // Reject double / dangerous extensions before trusting anything else.
  const lower = originalName.toLowerCase();
  const dotCount = (lower.match(/\./g) ?? []).length;
  if (dotCount > 1) {
    return { ok: false, reason: 'Suspicious filename (multiple extensions).' };
  }

  const detected = detectMime(buffer);
  if (!detected) {
    return { ok: false, reason: 'File content does not match an allowed type.' };
  }

  const storedName = `${crypto.randomUUID()}${EXT_FOR[detected]}`;
  return { ok: true, detectedMime: detected, storedName };
}

function detectMime(buffer: Buffer): AllowedMime | null {
  for (const mime of ALLOWED_MIME) {
    for (const sig of MAGIC[mime]) {
      if (sig.every((byte, i) => buffer[i] === byte)) return mime;
    }
  }
  return null;
}

/** Absolute on-disk path for a stored document (outside the web root). */
export function storagePathFor(storedName: string): string {
  return path.join(config.upload.dir, storedName);
}
