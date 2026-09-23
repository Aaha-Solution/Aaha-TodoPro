import express from 'express';
import {
  getAttachment,
  downloadAttachment,
  getAttachmentInfo,
} from '../controllers/attachmentController.js';

const router = express.Router();

// Download attachment
router.get('/:id/download', downloadAttachment);

// Metadata info
router.get('/:id/info', getAttachmentInfo);

// Inline view / stream binary from database (handles numeric IDs or complex filenames)
router.get('/:id(*)', getAttachment);

export default router;
