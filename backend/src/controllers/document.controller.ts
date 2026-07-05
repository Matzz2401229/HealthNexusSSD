import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import {
  createDocumentRequestBodySchema,
  documentIdParamsSchema,
  listDocumentRequestsQuerySchema,
  listDocumentsQuerySchema,
  reviewDocumentRequestBodySchema,
  reviewDocumentRequestParamsSchema,
  uploadDocumentHeadersSchema,
} from '../schemas/document.schema';
import { DocumentAccessError } from '../services/document.service';
import * as documentService from '../services/document.service';

function assertUser(req: Request) {
  if (!req.session.user) {
    throw new DocumentAccessError('Authentication required.', 401);
  }
  return req.session.user;
}

function handleDocumentError(err: unknown, next: NextFunction): void {
  if (err instanceof DocumentAccessError) {
    next(err);
    return;
  }
  next(err);
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const headers = uploadDocumentHeadersSchema.parse(req.headers);
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    const document = await documentService.uploadDocument({
      patientId: headers['x-patient-id'] ?? user.id,
      originalName: headers['x-file-name'],
      category: headers['x-document-category'] ?? 'general',
      description: headers['x-document-description'],
      buffer,
      uploadedBy: user.id,
    });

    res.status(201).json(document);
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const query = listDocumentsQuerySchema.parse(req.query);
    const documents = await documentService.listDocuments(user.id, user.role, query.patientId);
    res.json({ items: documents });
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const params = documentIdParamsSchema.parse(req.params);
    const document = await documentService.getDocument(user.id, user.role, params.documentId);
    res.json(document);
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function downloadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const params = documentIdParamsSchema.parse(req.params);
    const file = await documentService.getDocumentDownload(user.id, user.role, params.documentId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(file.path);
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const params = documentIdParamsSchema.parse(req.params);
    const body = createDocumentRequestBodySchema.parse(req.body);
    const requestRecord = await documentService.createDocumentRequest({
      documentId: params.documentId,
      requesterId: user.id,
      requesterRole: user.role,
      reason: body.reason,
    });

    res.status(201).json(requestRecord);
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const query = listDocumentRequestsQuerySchema.parse(req.query);
    const items = await documentService.listDocumentRequests(user.id, user.role, query.status);
    res.json({ items });
  } catch (err) {
    handleDocumentError(err, next);
  }
}

export async function reviewRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = assertUser(req);
    const params = reviewDocumentRequestParamsSchema.parse(req.params);
    const body = reviewDocumentRequestBodySchema.parse(req.body);
    const updated = await documentService.reviewDocumentRequest({
      requestId: params.requestId,
      reviewerId: user.id,
      reviewerRole: user.role,
      status: body.status,
    });

    res.json(updated);
  } catch (err) {
    handleDocumentError(err, next);
  }
}
