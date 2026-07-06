import fs from 'fs/promises';
import { query } from '../src/db/pool';
import { recordAudit } from '../src/services/audit.service';
import {
  createDocumentRequest,
  DocumentAccessError,
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
      .mockResolvedValueOnce([{ id: 77 }]);

    await expect(createDocumentRequest({
      documentId: 10,
      requesterId: 2,
      requesterRole: 'doctor',
      reason: 'Need for consultation',
    })).rejects.toThrow('pending request already exists');
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
});
