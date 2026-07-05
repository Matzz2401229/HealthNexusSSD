import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as documentController from '../controllers/document.controller';

const router = Router();

// Local-first upload contract: raw bytes + metadata headers avoids blocking on
// multipart parser dependencies while the team finishes auth/session work.
router.post(
  '/',
  requireAuth,
  express.raw({ type: '*/*', limit: '10mb' }),
  documentController.uploadDocument,
);

router.get('/', requireAuth, documentController.listDocuments);
router.get('/requests', requireAuth, documentController.listRequests);
router.get('/:documentId', requireAuth, documentController.getDocument);
router.get('/:documentId/download', requireAuth, documentController.downloadDocument);
router.post('/:documentId/requests', requireAuth, documentController.createRequest);
router.patch('/requests/:requestId', requireAuth, documentController.reviewRequest);

export default router;
