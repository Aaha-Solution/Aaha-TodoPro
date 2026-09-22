import { successResponse, errorResponse } from '../../../shared/response.js';
import { IhlrRequest } from '../models/IhlrRequest.js';

// In-memory fallback if DB is not reachable
let fallbackRequests = [
  {
    id: 1,
    req_no: '1',
    batch_date: '2026-09-01',
    shift: 'I',
    problem: 'Low voltage',
    model: 'OLS LONG ARM',
    problem_detected_at: 'Final Testing',
    received_from: 'D3/LINE',
    analysis_done_by: 'GURU',
    defect_image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    qa_why_why: ['Low voltage', 'Sensor improper soldering', 'Skipped visual inspection', '', ''],
    actual_qty: 1,
    four_m: 'MAN',
    resp: 'PROD',
    prod_why_why: ['Operator fatigue during shift end', 'Illumination level below 300 Lux at station', '', '', ''],
    action: 'Provide supplementary station LED lighting & retrain solder visual inspection check',
    evidence_attachment: 'IHLR_Action_Evid_001.pdf',
    target_date: '2026-09-15',
    remarks: 'Critical customer delivery batch containment completed',
    status: 'OPEN'
  },
  {
    id: 2,
    req_no: '2',
    batch_date: '2026-09-02',
    shift: 'II',
    problem: 'Flash / Burr excess on housing',
    model: 'CDI CAP HOUSING',
    problem_detected_at: 'Visual Inspection',
    received_from: 'MOLDING-02',
    analysis_done_by: 'iyyu',
    defect_image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60',
    qa_why_why: ['Burr on mating collar', 'Tool parting line wear', 'Exceeded shot life limit without polishing', '', ''],
    actual_qty: 5,
    four_m: 'MACHINE',
    resp: 'MAINT',
    prod_why_why: ['Core pin hydraulic drift', 'Seals degraded', '', '', ''],
    action: 'Replaced hydraulic cylinder seals and repolished tool parting line edges',
    evidence_attachment: 'Tooling_Inspection_Report.pdf',
    target_date: '2026-09-18',
    remarks: 'Tooling PM cycle updated from 50k to 35k shots',
    status: 'IN_PROGRESS'
  },
  {
    id: 3,
    req_no: '3',
    batch_date: '2026-09-03',
    shift: 'I',
    problem: 'Resistance out of specification (High)',
    model: 'STATOR COIL 35W',
    problem_detected_at: 'Electrical Testing',
    received_from: 'WINDING-01',
    analysis_done_by: 'GURU',
    defect_image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&auto=format&fit=crop&q=60',
    qa_why_why: ['Resistance > 1.8 Ohms', 'Tensioner wire stretching during winding', 'Brake pad worn out', '', ''],
    actual_qty: 3,
    four_m: 'METHOD',
    resp: 'PROD',
    prod_why_why: ['Tension gauge calibration overdue', '', '', '', ''],
    action: 'Recalibrated digital tensioner and replaced mechanical friction felt pad',
    evidence_attachment: 'Calibration_Cert_Sept26.pdf',
    target_date: '2026-09-10',
    remarks: 'First piece sample verified and approved by Quality Lead',
    status: 'CLOSED'
  }
];

export const getDashboardStats = async (req, res) => {
  try {
    let requests = await IhlrRequest.getAll();
    if (!requests) requests = fallbackRequests;

    const total = requests.length;
    const open = requests.filter(r => r.status === 'OPEN').length;
    const inProgress = requests.filter(r => r.status === 'IN_PROGRESS').length;
    const closed = requests.filter(r => r.status === 'CLOSED').length;

    const fourMBreakdown = {
      MAN: requests.filter(r => (r.four_m || '').toUpperCase() === 'MAN').length,
      MACHINE: requests.filter(r => (r.four_m || '').toUpperCase() === 'MACHINE').length,
      METHOD: requests.filter(r => (r.four_m || '').toUpperCase() === 'METHOD').length,
      MATERIAL: requests.filter(r => (r.four_m || '').toUpperCase() === 'MATERIAL').length,
    };

    return successResponse(res, {
      total,
      open,
      inProgress,
      closed,
      fourMBreakdown,
      recentRequests: requests.slice(0, 5)
    }, 'IHLR dashboard metrics retrieved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrRequests = async (req, res) => {
  try {
    let requests = await IhlrRequest.getAll();
    if (!requests) requests = fallbackRequests;

    const { search, shift, fourM, status } = req.query;

    if (search) {
      const q = search.toLowerCase();
      requests = requests.filter(r => 
        (r.problem && r.problem.toLowerCase().includes(q)) ||
        (r.model && r.model.toLowerCase().includes(q)) ||
        (r.received_from && r.received_from.toLowerCase().includes(q)) ||
        (r.analysis_done_by && r.analysis_done_by.toLowerCase().includes(q)) ||
        (String(r.req_no) && String(r.req_no).toLowerCase().includes(q))
      );
    }

    if (shift && shift !== 'All') {
      requests = requests.filter(r => r.shift === shift);
    }

    if (fourM && fourM !== 'All') {
      requests = requests.filter(r => (r.four_m || '').toUpperCase() === fourM.toUpperCase());
    }

    if (status && status !== 'All') {
      requests = requests.filter(r => (r.status || '').toUpperCase() === status.toUpperCase());
    }

    return successResponse(res, requests, 'IHLR requests retrieved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    let request = await IhlrRequest.getById(id);
    if (!request) {
      request = fallbackRequests.find(r => String(r.id) === String(id));
    }

    if (!request) {
      return errorResponse(res, 'IHLR Request not found', 404);
    }

    return successResponse(res, request, 'IHLR request details retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const createIhlrRequest = async (req, res) => {
  try {
    const data = req.body;
    if (!data.problem || !data.model) {
      return errorResponse(res, 'Problem description and Model are required', 400);
    }

    let created = await IhlrRequest.create(data);
    if (!created) {
      const newId = fallbackRequests.length > 0 ? Math.max(...fallbackRequests.map(r => r.id)) + 1 : 1;
      created = {
        id: newId,
        req_no: data.req_no || String(newId),
        batch_date: data.batch_date || new Date().toISOString().split('T')[0],
        shift: data.shift || 'I',
        problem: data.problem,
        model: data.model,
        problem_detected_at: data.problem_detected_at || 'Final Testing',
        received_from: data.received_from || 'Assembly Line',
        analysis_done_by: data.analysis_done_by || 'QC Lead',
        defect_image: data.defect_image || '',
        qa_why_why: data.qa_why_why || [],
        actual_qty: Number(data.actual_qty) || 1,
        four_m: data.four_m || 'MAN',
        resp: data.resp || 'PROD',
        prod_why_why: data.prod_why_why || [],
        action: data.action || '',
        evidence_attachment: data.evidence_attachment || '',
        target_date: data.target_date || null,
        remarks: data.remarks || '',
        status: data.status || 'OPEN',
        created_at: new Date().toISOString()
      };
      fallbackRequests.unshift(created);
    }

    return successResponse(res, created, 'IHLR request created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateIhlrRequest = async (req, res) => {
  try {
    const { id } = req.params;
    let updated = await IhlrRequest.update(id, req.body);
    if (!updated) {
      const idx = fallbackRequests.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) {
        fallbackRequests[idx] = { ...fallbackRequests[idx], ...req.body, updated_at: new Date().toISOString() };
        updated = fallbackRequests[idx];
      }
    }

    if (!updated) {
      return errorResponse(res, 'IHLR Request not found to update', 404);
    }

    return successResponse(res, updated, 'IHLR request updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteIhlrRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await IhlrRequest.delete(id);
    if (!deleted) {
      fallbackRequests = fallbackRequests.filter(r => String(r.id) !== String(id));
    }
    return successResponse(res, { id }, 'IHLR request deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrNotifications = (req, res) => {
  const notifications = [
    {
      id: 1,
      title: 'New IHLR Report Logged',
      message: 'Req #1 (Model: OLS LONG ARM) reported by GURU at Final Testing with defect "Low voltage".',
      date: '01 Sep 2026, 14:20',
      status: 'OPEN',
      read: false
    },
    {
      id: 2,
      title: 'Occurrence Cause Updated',
      message: 'Production Team added corrective countermeasure for Req #2 (CDI CAP HOUSING). Target Date: 18 Sep 2026.',
      date: '02 Sep 2026, 11:45',
      status: 'IN_PROGRESS',
      read: false
    },
    {
      id: 3,
      title: 'IHLR Case Closed',
      message: 'Req #3 (STATOR COIL 35W) verified and closed by Quality Head after tensioner recalibration.',
      date: '03 Sep 2026, 16:10',
      status: 'CLOSED',
      read: true
    }
  ];
  return successResponse(res, notifications, 'IHLR notifications retrieved');
};
