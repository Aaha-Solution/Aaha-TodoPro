import React from 'react';
import ExcelViewer from '../../components/common/ExcelViewer';

/**
 * Backward-compatible wrapper for Process Audit Excel preview.
 * Directly forwards to the universal ExcelViewer.
 */
const ProcessAuditExcelViewer = (props) => {
  return <ExcelViewer {...props} />;
};

export default ProcessAuditExcelViewer;
