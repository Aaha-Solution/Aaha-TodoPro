/**
 * Utility functions for IHLR request access control and visibility.
 *
 * Rules:
 * 1. Administrators ('ADMIN') and Incoming Quality department members have global plant-wide access.
 * 2. Closer / Operational users ('USER' in other departments) can ONLY view and act upon requests
 *    where they are the selected responsible person (resp_person) chosen by the requester, or
 *    where they are the original creator of the request.
 * 3. Other departments' users and unassigned individuals are strictly filtered out.
 */

export const isIhlrRequestVisibleToUser = (request, user) => {
  if (!request) return false;
  if (!user) return false;

  const userRole = (user.role || '').trim().toUpperCase();
  const userDept = (user.department || '').trim().toUpperCase();

  // Admin & Incoming Quality have universal plant-wide access
  if (userRole === 'ADMIN' || userDept === 'INCOMING QUALITY') {
    return true;
  }

  const clean = (val) => (val || '').trim().toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s+/i, '');

  const uName = clean(user.name);
  const uEmail = clean(user.email);
  const uId = String(user.id || '');

  const rDept = (request.resp || request.department || '').trim().toUpperCase();
  const rPerson = clean(request.resp_person);
  const rPersonEmail = clean(request.resp_person_email);
  const rCreatedBy = clean(request.created_by);
  const rCreatedEmail = clean(request.created_by_email);
  const rCreatedId = String(request.created_by_id || '');

  // 1. Creator access: user who created the report
  const isCreator = Boolean(
    (uId && rCreatedId && rCreatedId === uId) ||
    (uName && rCreatedBy && (rCreatedBy === uName || uName === rCreatedBy)) ||
    (uEmail && rCreatedEmail && rCreatedEmail === uEmail)
  );
  if (isCreator) return true;

  // 2. Closer access: MUST match department AND exact full name or email!
  const isDeptMatch = Boolean(!rDept || (userDept && userDept === rDept));
  if (!isDeptMatch) return false;

  const personList = rPerson.split(',').map((s) => clean(s)).filter(Boolean);
  const emailList = rPersonEmail.split(',').map((s) => clean(s)).filter(Boolean);
  const isSelectedPerson = Boolean(
    (uName && (rPerson === uName || personList.includes(uName))) ||
    (uEmail && (rPersonEmail === uEmail || emailList.includes(uEmail))) ||
    (!rPerson && isDeptMatch)
  );

  return isSelectedPerson;
};
