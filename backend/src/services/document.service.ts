import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db/pool';
import { config } from '../config/env';
import { validateUpload } from '../middleware/fileUpload';
import { Role } from '../middleware/auth';
import { recordAudit } from './audit.service';
import {
  CreateDocumentRequestInput,
  DocumentRecord,
  DocumentRequestRecord,
  DocumentRequestStatus,
  ReviewDocumentRequestInput,
  UploadDocumentInput,
} from '../types/document.types';

export class DocumentAccessError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function uploadRoot(): string {
  return path.resolve(config.upload.dir);
}

async function ensureUploadRoot(): Promise<void> {
  await fs.mkdir(uploadRoot(), { recursive: true });
}

function absoluteStoredPath(storedName: string): string {
  return path.join(uploadRoot(), storedName);
}

function toDocumentView(record: DocumentRecord) {
  return {
    id: record.id,
    patientId: record.patient_id,
    uploadedBy: record.uploaded_by,
    originalName: record.original_name,
    mimeType: record.mime_type,
    sizeBytes: record.size_bytes,
    category: record.category,
    description: record.description,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function toRequestView(record: DocumentRequestRecord) {
  return {
    id: record.id,
    documentId: record.document_id,
    requesterId: record.requester_id,
    requestedRole: record.requested_role,
    reason: record.reason,
    status: record.status,
    reviewedBy: record.reviewed_by,
    reviewedAt: record.reviewed_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function isPrivileged(role: Role): boolean {
  return role === 'doctor' || role === 'admin';
}

async function findDocumentById(documentId: number): Promise<DocumentRecord | null> {
  const rows = await query<DocumentRecord>(
    `SELECT id, patient_id, uploaded_by, stored_name, original_name, mime_type, size_bytes,
            sha256, category, description, status, created_at, updated_at
       FROM medical_document
      WHERE id = :documentId`,
    { documentId },
  );

  return rows[0] ?? null;
}

async function findRequestById(requestId: number): Promise<DocumentRequestRecord | null> {
  const rows = await query<DocumentRequestRecord>(
    `SELECT id, document_id, requester_id, requested_role, reason, status, reviewed_by,
            reviewed_at, created_at, updated_at
       FROM document_request
      WHERE id = :requestId`,
    { requestId },
  );

  return rows[0] ?? null;
}

async function hasApprovedRequest(documentId: number, requesterId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `SELECT id
       FROM document_request
      WHERE document_id = :documentId
        AND requester_id = :requesterId
        AND status = 'approved'
      LIMIT 1`,
    { documentId, requesterId },
  );

  return rows.length > 0;
}

async function assertCanAccessDocument(
  actorId: number,
  actorRole: Role,
  document: DocumentRecord,
): Promise<void> {
  if (document.status !== 'active') {
    throw new DocumentAccessError('Not found.', 404);
  }

  if (actorRole === 'patient' && actorId === document.patient_id) return;
  if (actorRole === 'admin') return;

  if (actorRole === 'doctor' || actorRole === 'pharmacist') {
    if (await hasApprovedRequest(document.id, actorId)) return;
  }

  throw new DocumentAccessError('Not found.', 404);
}

async function assertCanCreateRequest(
  actorId: number,
  actorRole: Role,
  document: DocumentRecord,
): Promise<void> {
  if (!isPrivileged(actorRole)) {
    throw new DocumentAccessError('Forbidden.', 403);
  }

  if (actorId === document.patient_id) {
    throw new DocumentAccessError('Forbidden.', 403);
  }

  const pending = await query<{ id: number }>(
    `SELECT id
       FROM document_request
      WHERE document_id = :documentId
        AND requester_id = :requesterId
        AND status = 'pending'
      LIMIT 1`,
    { documentId: document.id, requesterId: actorId },
  );

  if (pending.length > 0) {
    throw new DocumentAccessError('A pending request already exists for this document.', 409);
  }
}

async function assertCanReviewRequest(
  actorId: number,
  actorRole: Role,
  requestRecord: DocumentRequestRecord,
  document: DocumentRecord,
): Promise<void> {
  if (requestRecord.status !== 'pending') {
    throw new DocumentAccessError('Only pending requests can be reviewed.', 409);
  }

  if (actorRole === 'patient' && actorId === document.patient_id) return;
  if (actorRole === 'admin') return;

  throw new DocumentAccessError('Not found.', 404);
}

export async function uploadDocument(input: UploadDocumentInput) {
  if (input.uploadedBy !== input.patientId) {
    throw new DocumentAccessError('Patients may only upload their own documents for now.', 403);
  }

  const validation = validateUpload(input.originalName, input.buffer);
  if (!validation.ok || !validation.detectedMime || !validation.storedName) {
    throw new DocumentAccessError(validation.reason ?? 'Invalid document upload.', 400);
  }

  await ensureUploadRoot();

  const storedPath = absoluteStoredPath(validation.storedName);
  const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

  try {
    await fs.writeFile(storedPath, input.buffer, { flag: 'wx' });

    await query(
      `INSERT INTO medical_document
         (patient_id, uploaded_by, stored_name, original_name, mime_type, size_bytes,
          sha256, category, description, status)
       VALUES
         (:patientId, :uploadedBy, :storedName, :originalName, :mimeType, :sizeBytes,
          :sha256, :category, :description, 'active')`,
      {
        patientId: input.patientId,
        uploadedBy: input.uploadedBy,
        storedName: validation.storedName,
        originalName: input.originalName,
        mimeType: validation.detectedMime,
        sizeBytes: input.buffer.length,
        sha256,
        category: input.category,
        description: input.description ?? null,
      },
    );

    const rows = await query<DocumentRecord>(
      `SELECT id, patient_id, uploaded_by, stored_name, original_name, mime_type, size_bytes,
              sha256, category, description, status, created_at, updated_at
         FROM medical_document
        WHERE stored_name = :storedName
        LIMIT 1`,
      { storedName: validation.storedName },
    );

    const document = rows[0];
    await recordAudit({
      userId: input.uploadedBy,
      role: 'patient',
      action: 'document.upload',
      target: String(document.id),
      result: 'success',
    });

    return toDocumentView(document);
  } catch (err) {
    await fs.rm(storedPath, { force: true });
    await recordAudit({
      userId: input.uploadedBy,
      role: 'patient',
      action: 'document.upload',
      target: input.originalName,
      result: 'failure',
    });
    throw err;
  }
}

export async function listDocuments(actorId: number, actorRole: Role, patientId?: number) {
  const targetPatientId = actorRole === 'patient' ? actorId : patientId;
  if (!targetPatientId) {
    throw new DocumentAccessError('patientId is required for staff document listing.', 400);
  }

  if (actorRole !== 'patient') {
    throw new DocumentAccessError('Staff-wide document listing is blocked until ownership integration is finished.', 403);
  }

  const rows = await query<DocumentRecord>(
    `SELECT id, patient_id, uploaded_by, stored_name, original_name, mime_type, size_bytes,
            sha256, category, description, status, created_at, updated_at
       FROM medical_document
      WHERE patient_id = :patientId
        AND status = 'active'
      ORDER BY created_at DESC`,
    { patientId: targetPatientId },
  );

  return rows.map(toDocumentView);
}

export async function getDocument(actorId: number, actorRole: Role, documentId: number) {
  const document = await findDocumentById(documentId);
  if (!document) {
    throw new DocumentAccessError('Not found.', 404);
  }

  await assertCanAccessDocument(actorId, actorRole, document);
  return toDocumentView(document);
}

export async function getDocumentDownload(actorId: number, actorRole: Role, documentId: number) {
  const document = await findDocumentById(documentId);
  if (!document) {
    throw new DocumentAccessError('Not found.', 404);
  }

  await assertCanAccessDocument(actorId, actorRole, document);

  await recordAudit({
    userId: actorId,
    role: actorRole,
    action: 'document.download',
    target: String(document.id),
    result: 'success',
  });

  return {
    path: absoluteStoredPath(document.stored_name),
    mimeType: document.mime_type,
    originalName: document.original_name,
    sizeBytes: document.size_bytes,
  };
}

export async function createDocumentRequest(input: CreateDocumentRequestInput) {
  const document = await findDocumentById(input.documentId);
  if (!document) {
    throw new DocumentAccessError('Not found.', 404);
  }

  await assertCanCreateRequest(input.requesterId, input.requesterRole, document);

  await query(
    `INSERT INTO document_request
       (document_id, requester_id, requested_role, reason, status)
     VALUES
       (:documentId, :requesterId, :requestedRole, :reason, 'pending')`,
    {
      documentId: input.documentId,
      requesterId: input.requesterId,
      requestedRole: input.requesterRole,
      reason: input.reason ?? null,
    },
  );

  const rows = await query<DocumentRequestRecord>(
    `SELECT id, document_id, requester_id, requested_role, reason, status, reviewed_by,
            reviewed_at, created_at, updated_at
       FROM document_request
      WHERE document_id = :documentId
        AND requester_id = :requesterId
      ORDER BY id DESC
      LIMIT 1`,
    { documentId: input.documentId, requesterId: input.requesterId },
  );

  const requestRecord = rows[0];
  await recordAudit({
    userId: input.requesterId,
    role: input.requesterRole,
    action: 'document.request.create',
    target: String(input.documentId),
    result: 'success',
  });

  return toRequestView(requestRecord);
}

export async function listDocumentRequests(
  actorId: number,
  actorRole: Role,
  status?: DocumentRequestStatus,
) {
  if (actorRole === 'patient') {
    const rows = await query<DocumentRequestRecord>(
      `SELECT dr.id, dr.document_id, dr.requester_id, dr.requested_role, dr.reason, dr.status,
              dr.reviewed_by, dr.reviewed_at, dr.created_at, dr.updated_at
         FROM document_request dr
         JOIN medical_document md ON md.id = dr.document_id
        WHERE md.patient_id = :actorId
          ${status ? "AND dr.status = :status" : ''}
        ORDER BY dr.created_at DESC`,
      status ? { actorId, status } : { actorId },
    );

    return rows.map(toRequestView);
  }

  const rows = await query<DocumentRequestRecord>(
    `SELECT id, document_id, requester_id, requested_role, reason, status, reviewed_by,
            reviewed_at, created_at, updated_at
       FROM document_request
      WHERE requester_id = :actorId
        ${status ? "AND status = :status" : ''}
      ORDER BY created_at DESC`,
    status ? { actorId, status } : { actorId },
  );

  return rows.map(toRequestView);
}

export async function reviewDocumentRequest(input: ReviewDocumentRequestInput) {
  const requestRecord = await findRequestById(input.requestId);
  if (!requestRecord) {
    throw new DocumentAccessError('Not found.', 404);
  }

  const document = await findDocumentById(requestRecord.document_id);
  if (!document) {
    throw new DocumentAccessError('Not found.', 404);
  }

  await assertCanReviewRequest(input.reviewerId, input.reviewerRole, requestRecord, document);

  await query(
    `UPDATE document_request
        SET status = :status,
            reviewed_by = :reviewedBy,
            reviewed_at = CURRENT_TIMESTAMP
      WHERE id = :requestId`,
    {
      status: input.status,
      reviewedBy: input.reviewerId,
      requestId: input.requestId,
    },
  );

  const updated = await findRequestById(input.requestId);
  await recordAudit({
    userId: input.reviewerId,
    role: input.reviewerRole,
    action: `document.request.${input.status}`,
    target: String(input.requestId),
    result: 'success',
  });

  return toRequestView(updated as DocumentRequestRecord);
}
