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
