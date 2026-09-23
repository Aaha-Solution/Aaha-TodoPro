import { successResponse, errorResponse } from '../../../shared/response.js';
import { IhlrRequest } from '../models/IhlrRequest.js';

// In-memory fallback if DB is not reachable
let fallbackRequests = [];

export const getNextReqNo = async (req, res) => {
  try {
    let nextReqNo = await IhlrRequest.getNextReqNo();
    if (!nextReqNo) {
      let max = 0;
      for (const r of fallbackRequests) {
        const match = String(r.req_no || '').match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
      nextReqNo = `IHLR-${max + 1}`;
    }
    return successResponse(res, { nextReqNo }, 'Next Request Number calculated');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

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
      let calculatedReqNo = data.req_no;
      if (!calculatedReqNo) {
        let max = 0;
        for (const r of fallbackRequests) {
          const match = String(r.req_no || '').match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
          }
        }
        calculatedReqNo = `IHLR-${max + 1}`;
      }
      created = {
        id: newId,
        req_no: calculatedReqNo,
        batch_date: data.batch_date || new Date().toISOString().split('T')[0],
        shift: data.shift || 'I',
        problem: data.problem,
        model: data.model,
        problem_detected_at: data.problem_detected_at || '',
        received_from: data.received_from || '',
        analysis_done_by: data.analysis_done_by || '',
        defect_image: data.defect_image || '',
        qa_why_why: data.qa_why_why || [],
        actual_qty: data.actual_qty ? Number(data.actual_qty) : 1,
        four_m: data.four_m || 'MAN',
        resp: data.resp || 'PRODUCTION',
        resp_person: data.resp_person || '',
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
