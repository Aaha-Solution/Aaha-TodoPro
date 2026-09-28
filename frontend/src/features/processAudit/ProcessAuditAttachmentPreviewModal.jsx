import React from 'react';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';

/**
 * Backward-compatible wrapper for Process Audit attachment preview.
 * Directly forwards to the universal AttachmentPreviewModal.
 */
const ProcessAuditAttachmentPreviewModal = (props) => {
  return <AttachmentPreviewModal {...props} />;
};

export default ProcessAuditAttachmentPreviewModal;
