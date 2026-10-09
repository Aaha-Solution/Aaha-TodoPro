export const APP_NAME = "Todo";
export const COMPANY_NAME = "India Nippon Electricals Limited";

export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
};

export const DEPARTMENTS = [
  'MAINTENANCE',
  'PRODUCTION',
  'PED',
  'MATERIALS',
  'MARKETING',
  'INCOMING QUALITY'
];

export const SHIFTS = [
  'Shift 1',
  'Shift 2',
  'Shift 3',
  'General'
];

export const IHLR_SHIFTS = [
  {
    id: 'Shift 1',
    name: 'Shift 1',
    timing: '06:30 - 15:00',
    timeDisplay: '06:30 AM - 03:00 PM',
    label: 'Shift 1 (06:30 AM - 03:00 PM)'
  },
  {
    id: 'Shift 2',
    name: 'Shift 2',
    timing: '15:00 - 23:30',
    timeDisplay: '03:00 PM - 11:30 PM',
    label: 'Shift 2 (03:00 PM - 11:30 PM)'
  },
  {
    id: 'Shift 3',
    name: 'Shift 3',
    timing: '23:30 - 06:00',
    timeDisplay: '11:30 PM - 06:00 AM',
    label: 'Shift 3 (11:30 PM - 06:00 AM)'
  },
  {
    id: 'General',
    name: 'General',
    timing: '08:30 - 17:00',
    timeDisplay: '08:30 AM - 05:00 PM',
    label: 'General (08:30 AM - 05:00 PM)'
  }
];

export const getIhlrShiftDetails = (shiftVal) => {
  if (!shiftVal) return null;
  const s = String(shiftVal).trim().toLowerCase();
  if (s.includes('gen')) return IHLR_SHIFTS[3];
  if (s.includes('1') || s === 'i') return IHLR_SHIFTS[0];
  if (s.includes('2') || s === 'ii') return IHLR_SHIFTS[1];
  if (s.includes('3') || s === 'iii') return IHLR_SHIFTS[2];
  return null;
};

export const getCurrentIhlrShift = () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  // Shift 1: 06:30 (390 mins) to 15:00 (900 mins)
  if (currentMinutes >= 390 && currentMinutes < 900) {
    return 'Shift 1';
  }
  // Shift 2: 15:00 (900 mins) to 23:30 (1410 mins)
  if (currentMinutes >= 900 && currentMinutes < 1410) {
    return 'Shift 2';
  }
  // Shift 3: 23:30 (1410 mins) to 06:30 (390 mins)
  return 'Shift 3';
};

export const formatIhlrShiftDisplay = (shiftVal, includeTiming = false) => {
  const details = getIhlrShiftDetails(shiftVal);
  if (details) {
    return includeTiming ? `${details.name} (${details.timing})` : details.name;
  }
  const s = String(shiftVal || '').trim();
  if (!s) return '—';
  return s.toLowerCase().startsWith('shift') || s.toLowerCase().includes('gen') ? s : `Shift ${s}`;
};

export const SYSTEMS = [
  {
    id: "processAudit",
    name: "Process Audit",
    code: "PA",
    description: "Audit scheduling, execution, checklists, observations, and CAPA tracking",
    path: "/process-audit",
    color: "from-blue-600 to-indigo-600",
  },
  {
    id: "ihlr",
    name: "IHLR (In-House Line Rejection)",
    code: "IHLR",
    description: "Line rejection tracking, scrap monitoring, RCA (5 Why / Fishbone), and CAPA",
    path: "/ihlr",
    color: "from-emerald-600 to-teal-600",
  },
  {
    id: "tryOutStatus",
    name: "Try-Out Status",
    code: "TOS",
    description: "New tooling / process trials, pilot batch tracking, and sample approval records",
    path: "/tryout-status",
    color: "from-amber-500 to-orange-600",
  },
];
