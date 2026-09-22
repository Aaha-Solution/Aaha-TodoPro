import api from './api';

// Fallback initial data matching the SEP'26 IHLR- ANALYSIS REPORT specification
const initialMockRequests = [
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

let localIhlrStore = [...initialMockRequests];

export const ihlrService = {
  getDashboardStats: async () => {
    try {
      const res = await api.get('/ihlr/dashboard');
      return res.data?.data || res.data;
    } catch {
      const total = localIhlrStore.length;
      const open = localIhlrStore.filter(r => r.status === 'OPEN').length;
      const inProgress = localIhlrStore.filter(r => r.status === 'IN_PROGRESS').length;
      const closed = localIhlrStore.filter(r => r.status === 'CLOSED').length;
      return {
        total,
        open,
        inProgress,
        closed,
        fourMBreakdown: {
          MAN: localIhlrStore.filter(r => r.four_m === 'MAN').length,
          MACHINE: localIhlrStore.filter(r => r.four_m === 'MACHINE').length,
          METHOD: localIhlrStore.filter(r => r.four_m === 'METHOD').length,
          MATERIAL: localIhlrStore.filter(r => r.four_m === 'MATERIAL').length,
        },
        recentRequests: localIhlrStore.slice(0, 5)
      };
    }
  },

  getRequests: async (filters = {}) => {
    try {
      const res = await api.get('/ihlr/requests', { params: filters });
      return res.data?.data || res.data;
    } catch {
      let data = [...localIhlrStore];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        data = data.filter(r => 
          (r.problem && r.problem.toLowerCase().includes(q)) ||
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.received_from && r.received_from.toLowerCase().includes(q)) ||
          (r.analysis_done_by && r.analysis_done_by.toLowerCase().includes(q))
        );
      }
      if (filters.shift && filters.shift !== 'All') {
        data = data.filter(r => r.shift === filters.shift);
      }
      if (filters.fourM && filters.fourM !== 'All') {
        data = data.filter(r => r.four_m === filters.fourM);
      }
      if (filters.status && filters.status !== 'All') {
        data = data.filter(r => r.status === filters.status);
      }
      return data;
    }
  },

  getRequestById: async (id) => {
    try {
      const res = await api.get(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch {
      return localIhlrStore.find(r => String(r.id) === String(id)) || null;
    }
  },

  createRequest: async (formData) => {
    try {
      const res = await api.post('/ihlr/requests', formData);
      return res.data?.data || res.data;
    } catch {
      const newId = localIhlrStore.length > 0 ? Math.max(...localIhlrStore.map(r => r.id)) + 1 : 1;
      const newReq = {
        id: newId,
        req_no: formData.req_no || String(newId),
        batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
        shift: formData.shift || 'I',
        problem: formData.problem,
        model: formData.model,
        problem_detected_at: formData.problem_detected_at || 'Final Testing',
        received_from: formData.received_from || 'Assembly Line',
        analysis_done_by: formData.analysis_done_by || 'QC Lead',
        defect_image: formData.defect_image || '',
        qa_why_why: formData.qa_why_why || ['', '', '', '', ''],
        actual_qty: Number(formData.actual_qty) || 1,
        four_m: formData.four_m || 'MAN',
        resp: formData.resp || 'PROD',
        prod_why_why: formData.prod_why_why || ['', '', '', '', ''],
        action: formData.action || '',
        evidence_attachment: formData.evidence_attachment || '',
        target_date: formData.target_date || null,
        remarks: formData.remarks || '',
        status: formData.status || 'OPEN',
        created_at: new Date().toISOString()
      };
      localIhlrStore.unshift(newReq);
      return newReq;
    }
  },

  updateRequest: async (id, updates) => {
    try {
      const res = await api.put(`/ihlr/requests/${id}`, updates);
      return res.data?.data || res.data;
    } catch {
      const idx = localIhlrStore.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) {
        localIhlrStore[idx] = { ...localIhlrStore[idx], ...updates, updated_at: new Date().toISOString() };
        return localIhlrStore[idx];
      }
      return null;
    }
  },

  deleteRequest: async (id) => {
    try {
      const res = await api.delete(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch {
      localIhlrStore = localIhlrStore.filter(r => String(r.id) !== String(id));
      return { id };
    }
  },

  getNotifications: async () => {
    try {
      const res = await api.get('/ihlr/notifications');
      return res.data?.data || res.data;
    } catch {
      return [
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
    }
  }
};

export default ihlrService;
