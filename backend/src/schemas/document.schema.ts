import { z } from 'zod';

export const documentCategorySchema = z.enum([
  'lab',
  'imaging',
  'prescription',
  'referral',
  'general',
]);

export const uploadDocumentHeadersSchema = z.object({
  'x-file-name': z.string().min(1).max(255),
  'x-document-category': documentCategorySchema.optional(),
  'x-document-description': z.string().max(500).optional(),
  'x-patient-id': z.coerce.number().int().positive().optional(),
});

export const listDocumentsQuerySchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
});

export const documentIdParamsSchema = z.object({
  documentId: z.coerce.number().int().positive(),
});

export const createDocumentRequestBodySchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const reviewDocumentRequestParamsSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

export const reviewDocumentRequestBodySchema = z.object({
  status: z.enum(['approved', 'denied', 'revoked']),
});

export const listDocumentRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'denied', 'revoked']).optional(),
});
