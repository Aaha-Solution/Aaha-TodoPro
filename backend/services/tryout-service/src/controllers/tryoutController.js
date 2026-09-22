import { successResponse } from '../../../shared/response.js';

const mockTrials = [
  { id: 'TR-501', toolCode: 'DIE-M74', project: 'EV Inverter Housing', stage: 'T1 Trial', status: 'Passed Initial CMM', trialDate: '2026-09-18', approvalTier: 'Tier 1 Signed' },
  { id: 'TR-502', toolCode: 'STAMP-209', project: 'Alternator Core', stage: 'T2 Trial', status: 'Under Inspection', trialDate: '2026-09-20', approvalTier: 'Pending Quality QA' },
  { id: 'TR-503', toolCode: 'MOLD-411', project: 'Regulator Box', stage: 'Pilot Run', status: 'Approved for SOP', trialDate: '2026-09-21', approvalTier: 'Plant Head Approved' },
];

export const getDashboardStats = (req, res) => {
  return successResponse(res, {
    activeTrials: 14,
    pendingApprovals: 6,
    pilotBatches: 3,
    firstTimeRightRate: 92.5,
  }, 'Try Out Status metrics retrieved successfully');
};

export const getTrialRuns = (req, res) => {
  return successResponse(res, mockTrials);
};

export const createTrialRun = (req, res) => {
  const trial = {
    id: `TR-${Math.floor(500 + Math.random() * 500)}`,
    ...req.body,
    trialDate: new Date().toISOString().split('T')[0],
  };
  mockTrials.unshift(trial);
  return successResponse(res, trial, 'Trial run recorded successfully', 201);
};
