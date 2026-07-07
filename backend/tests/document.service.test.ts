import fs from 'fs/promises';
import { query } from '../src/db/pool';
import { recordAudit } from '../src/services/audit.service';
import {
  createDocumentRequest,
  DocumentAccessError,
  getDocument,
  listRequestableDocuments,
  listRequestablePatients,
  listDocumentRequests,
  reviewDocumentRequest,
  uploadDocument,
} from '../src/services/document.service';

jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
}));

jest.mock('../src/services/audit.service', () => ({
  recordAudit: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  rm: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedAudit = recordAudit as jest.MockedFunction<typeof recordAudit>;
const mockedFs = fs as jest.Mocked<typeof fs>;

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe('document.service', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedAudit.mockReset();
    mockedFs.mkdir.mockReset();
    mockedFs.writeFile.mockReset();
    mockedFs.rm.mockReset();
  });

  it('cleans up the stored file when the metadata insert fails', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('db insert failed'));

    await expect(uploadDocument({
      patientId: 1,
      originalName: 'scan.pdf',
      category: 'general',
      buffer: PDF,
      uploadedBy: 1,
      actorRole: 'patient',
    })).rejects.toThrow('db insert failed');

    expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
    expect(mockedFs.rm).toHaveBeenCalledTimes(1);
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.upload',
      result: 'failure',
    }));
  });

  it('blocks duplicate pending requests for the same requester/document pair', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 77 }]);

    await expect(createDocumentRequest({
      documentId: 10,
      requesterId: 2,
      requesterRole: 'doctor',
      reason: 'Need for consultation',
    })).rejects.toThrow('pending request already exists');
  });

  it('blocks a doctor from requesting an unrelated patient document', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 99,
        uploaded_by: 99,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([]);

    await expect(createDocumentRequest({
      documentId: 10,
      requesterId: 2,
      requesterRole: 'doctor',
      reason: 'Need for consultation',
    })).rejects.toMatchObject<DocumentAccessError>({ statusCode: 403 });
  });

  it('blocks pharmacists from creating document requests', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 10,
      patient_id: 1,
      uploaded_by: 1,
      stored_name: 'uuid.pdf',
      original_name: 'scan.pdf',
      mime_type: 'application/pdf',
      size_bytes: 5,
      sha256: null,
      category: 'general',
      description: null,
      status: 'active',
      created_at: '2026-07-04T00:00:00.000Z',
      updated_at: '2026-07-04T00:00:00.000Z',
    }]);

    await expect(createDocumentRequest({
      documentId: 10,
      requesterId: 3,
      requesterRole: 'pharmacist',
      reason: 'Dispensing support',
    })).rejects.toMatchObject<DocumentAccessError>({ statusCode: 403 });
  });

  it('lists only requestable patients for a doctor scope', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 6,
      full_name: 'Patient Two',
      email: 'patient2@test.com',
    }]);

    const result = await listRequestablePatients(7, 'doctor', 'patient');

    expect(result).toEqual([expect.objectContaining({
      id: 6,
      fullName: 'Patient Two',
      email: 'patient2@test.com',
    })]);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('JOIN doctor_patient_auth dpa'),
      expect.objectContaining({ actorId: 7 }),
    );
  });

  it('blocks requestable document listing for unrelated doctor patient scope', async () => {
    mockedQuery.mockResolvedValueOnce([]);

    await expect(listRequestableDocuments(7, 'doctor', 8))
      .rejects.toMatchObject<DocumentAccessError>({ statusCode: 403 });
  });

  it('allows a patient owner to approve a pending request', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'approved',
        reviewed_by: 1,
        reviewed_at: '2026-07-04T01:00:00.000Z',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T01:00:00.000Z',
      }]);

    const result = await reviewDocumentRequest({
      requestId: 55,
      reviewerId: 1,
      reviewerRole: 'patient',
      status: 'approved',
    });

    expect(result.status).toBe('approved');
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.request.approved',
      result: 'success',
    }));
  });

  it('lists pending staff requests for documents owned by the patient', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 88,
      document_id: 10,
      requester_id: 2,
      requested_role: 'doctor',
      reason: 'Need the record for follow-up care',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2026-07-04T00:00:00.000Z',
      updated_at: '2026-07-04T00:00:00.000Z',
    }]);

    const result = await listDocumentRequests(1, 'patient', 'pending');

    expect(result).toEqual([expect.objectContaining({
      id: 88,
      documentId: 10,
      requesterId: 2,
      requestedRole: 'doctor',
      status: 'pending',
    })]);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('JOIN medical_document md ON md.id = dr.document_id'),
      { actorId: 1, status: 'pending' },
    );
  });

  it('allows an admin to approve a pending access request', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'approved',
        reviewed_by: 4,
        reviewed_at: '2026-07-04T01:00:00.000Z',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T01:00:00.000Z',
      }]);

    const result = await reviewDocumentRequest({
      requestId: 55,
      reviewerId: 4,
      reviewerRole: 'admin',
      status: 'approved',
    });

    expect(result.status).toBe('approved');
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.request.approved',
      result: 'success',
    }));
  });

  it('blocks an admin from approving their own document request', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 4,
        requested_role: 'admin',
        reason: 'Operational review',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }]);

    await expect(reviewDocumentRequest({
      requestId: 55,
      reviewerId: 4,
      reviewerRole: 'admin',
      status: 'approved',
    })).rejects.toMatchObject<DocumentAccessError>({ statusCode: 404 });
  });

  it('allows a patient owner to revoke approved access', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'approved',
        reviewed_by: 1,
        reviewed_at: '2026-07-04T01:00:00.000Z',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T01:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'revoked',
        reviewed_by: 1,
        reviewed_at: '2026-07-04T02:00:00.000Z',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T02:00:00.000Z',
      }]);

    const result = await reviewDocumentRequest({
      requestId: 55,
      reviewerId: 1,
      reviewerRole: 'patient',
      status: 'revoked',
    });

    expect(result.status).toBe('revoked');
  });

  it('returns 404 when a non-owner patient tries to review another patient request', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 55,
        document_id: 10,
        requester_id: 2,
        requested_role: 'doctor',
        reason: 'Need review',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 99,
        uploaded_by: 99,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }]);

    await expect(reviewDocumentRequest({
      requestId: 55,
      reviewerId: 1,
      reviewerRole: 'patient',
      status: 'denied',
    })).rejects.toMatchObject<DocumentAccessError>({ statusCode: 404 });
  });

  it('does not let an admin open a document without an approved request', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([]);

    await expect(getDocument(4, 'admin', 10))
      .rejects.toMatchObject<DocumentAccessError>({ statusCode: 404 });
  });

  it('lets an admin open only documents released to that admin account', async () => {
    mockedQuery
      .mockResolvedValueOnce([{
        id: 10,
        patient_id: 1,
        uploaded_by: 1,
        stored_name: 'uuid.pdf',
        original_name: 'scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 5,
        sha256: null,
        category: 'general',
        description: null,
        status: 'active',
        created_at: '2026-07-04T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{ id: 99 }]);

    const result = await getDocument(4, 'admin', 10);

    expect(result.id).toBe(10);
    expect(result.patientId).toBe(1);
  });

  it('blocks admins from uploading clinical documents', async () => {
    await expect(uploadDocument({
      patientId: 1,
      originalName: 'scan.pdf',
      category: 'general',
      buffer: PDF,
      uploadedBy: 4,
      actorRole: 'admin',
    })).rejects.toMatchObject<DocumentAccessError>({ statusCode: 403 });

    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedFs.writeFile).not.toHaveBeenCalled();
  });
});
