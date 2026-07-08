import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { pool, query } from '../db/pool';

type SeededDocument = {
  id: number;
  stored_name: string;
  original_name: string;
  category: string;
  description: string | null;
};

const SEEDED_DOCUMENT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfLines(document: SeededDocument): string[] {
  return [
    'HealthNexus Medical Record',
    '',
    `Document ID: ${document.id}`,
    `Document name: ${document.original_name}`,
    `Category: ${document.category}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Confidential patient document.',
    'This file is stored in protected application storage and served only through authenticated routes.',
    '',
    'Clinical note:',
    document.description ?? 'No additional notes recorded.',
  ];
}

function buildPdfBuffer(lines: string[]): Buffer {
  const content: string[] = ['BT', '/F1 18 Tf', '50 790 Td'];

  lines.forEach((line, index) => {
    if (index === 1) {
      content.push('0 -18 Td');
    } else if (index > 0) {
      content.push('0 -22 Td');
    }

    if (index === 2) {
      content.push('/F1 12 Tf');
    }

    content.push(`(${escapePdfText(line)}) Tj`);
  });

  content.push('ET');

  const stream = content.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

async function main() {
  const uploadDir = path.resolve(config.upload.dir);
  await fs.mkdir(uploadDir, { recursive: true });

  const documents = await query<SeededDocument>(
    `SELECT id, stored_name, original_name, category, description
       FROM medical_document
      WHERE id IN (${SEEDED_DOCUMENT_IDS.join(',')})
      ORDER BY id ASC`,
  );

  if (documents.length === 0) {
    throw new Error('No seeded medical_document rows were found. Load db/seed.sql first.');
  }

  for (const document of documents) {
    const buffer = buildPdfBuffer(buildPdfLines(document));
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const filePath = path.join(uploadDir, document.stored_name);

    await fs.writeFile(filePath, buffer);

    await query(
      `UPDATE medical_document
          SET mime_type = 'application/pdf',
              size_bytes = :sizeBytes,
              sha256 = :sha256,
              updated_at = NOW()
        WHERE id = :documentId`,
      {
        documentId: document.id,
        sizeBytes: buffer.length,
        sha256,
      },
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
