import { AllowedMime } from '../middleware/fileUpload';
import { Role } from '../middleware/auth';

export type DocumentCategory = 'lab' | 'imaging' | 'prescription' | 'referral' | 'general';
export type DocumentStatus = 'active' | 'deleted' | 'quarantined';
export type DocumentRequestStatus = 'pending' | 'approved' | 'denied' | 'revoked';

export interface DocumentRecord {
  id: number;
  patient_id: number;
  uploaded_by: number;
  stored_name: string;
  original_name: string;
  mime_type: AllowedMime;
  size_bytes: number;
  sha256: string | null;
  category: DocumentCategory;
  description: string | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestRecord {
  id: number;
  document_id: number;
  requester_id: number;
  requested_role: Role | null;
  reason: string | null;
  status: DocumentRequestStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
  document_title?: string | null;
  document_category?: DocumentCategory | null;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
}

export interface UploadDocumentInput {
  patientId: number;
  originalName: string;
  category: DocumentCategory;
  description?: string;
  buffer: Buffer;
  uploadedBy: number;
  actorRole: Role;
}

export interface CreateDocumentRequestInput {
  documentId: number;
  requesterId: number;
  requesterRole: Role;
  reason?: string;
}

export interface ReviewDocumentRequestInput {
  requestId: number;
  reviewerId: number;
  reviewerRole: Role;
  status: Extract<DocumentRequestStatus, 'approved' | 'denied' | 'revoked'>;
}

export interface DeleteDocumentInput {
  documentId: number;
  actorId: number;
  actorRole: Role;
}

export interface RequestablePatientRecord {
  id: number;
  full_name: string;
  email: string;
}

export interface RequestableDocumentRecord {
  id: number;
  patient_id: number;
  original_name: string;
  category: DocumentCategory;
  description: string | null;
  created_at: string;
}
