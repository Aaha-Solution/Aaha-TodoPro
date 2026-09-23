import React from 'react';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';

/**
 * Backward compatibility facade for IHLR.
 * Directly forwards to the universal AttachmentPreviewModal.
 */
const IhlrAttachmentPreviewModal = (props) => {
  return <AttachmentPreviewModal {...props} />;
};

export default IhlrAttachmentPreviewModal;
