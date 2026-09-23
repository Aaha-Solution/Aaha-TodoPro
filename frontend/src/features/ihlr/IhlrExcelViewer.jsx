import React from 'react';
import ExcelViewer from '../../components/common/ExcelViewer';

/**
 * Backward compatibility facade for IHLR.
 * Directly forwards to the universal ExcelViewer.
 */
const IhlrExcelViewer = (props) => {
  return <ExcelViewer {...props} />;
};

export default IhlrExcelViewer;
