import { successResponse } from '../../../shared/response.js';

const mockRejections = [
  { id: 'LR-101', partNumber: 'INEL-CDI-902', line: 'SMT Line 1', defectType: 'Solder Bridge', qty: 12, status: 'RCA Assigned', severity: 'Critical', reportedAt: '2026-09-21' },
  { id: 'LR-102', partNumber: 'INEL-REG-401', line: 'Molding Cell B', defectType: 'Flash / Burr', qty: 5, status: 'Contained', severity: 'Major', reportedAt: '2026-09-22' },
  { id: 'LR-103', partNumber: 'INEL-STATOR-31', line: 'Winding Bay 4', defectType: 'Insulation Damage', qty: 3, status: 'Closed', severity: 'Minor', reportedAt: '2026-09-20' },
];

const mockScrap = [
  { id: 'SCRAP-088', material: 'Copper Wire', weightKg: 45.2, disposalStatus: 'Approved For Recirculation', date: '2026-09-21' },
  { id: 'SCRAP-089', material: 'Resin Molding Trim', weightKg: 139.3, disposalStatus: 'Sent To Granulator', date: '2026-09-22' },
];

export const getDashboardStats = (req, res) => {
  return successResponse(res, {
    totalRejections: 128,
    ppmRate: 420,
    pendingRCA: 4,
    scrapWeightKg: 184.5,
    costImpact: '₹ 1,42,800',
  }, 'IHLR metrics retrieved successfully');
};

export const getLineRejections = (req, res) => {
  return successResponse(res, mockRejections);
};

export const createLineRejection = (req, res) => {
  const item = {
    id: `LR-${Math.floor(100 + Math.random() * 900)}`,
    ...req.body,
    reportedAt: new Date().toISOString().split('T')[0],
  };
  mockRejections.unshift(item);
  return successResponse(res, item, 'Line rejection recorded', 201);
};

export const getScrapMonitoring = (req, res) => {
  return successResponse(res, mockScrap);
};
