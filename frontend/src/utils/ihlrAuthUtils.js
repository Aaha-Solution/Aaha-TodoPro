/**
 * Utility functions for IHLR request access control and visibility.
 *
 * Rules:
 * 1. Administrators ('ADMIN') and Incoming Quality (QAD) department members have global plant-wide access.
 * 2. In Approvals & Closer Log: Only designated responsible persons (resp_person) who were assigned to
 *    investigate and submit 5-Why root cause countermeasures can access the request.
 *    Requesters who raised the request track their report in "All Requests / My Requests", NOT in Approvals.
 * 3. In Notifications feed: Both assigned persons and creators are kept informed.
 */

export const isIhlrRequestAssignedToUser = (request, user) => {
  if (!request || !user) return false;

  const userRole = (user.role || '').trim().toUpperCase();
  const userDept = (user.department || '').trim().toUpperCase();

  // Admin & QAD have universal plant-wide access in Approvals
  if (userRole === 'ADMIN' || userDept === 'QAD') {
    return true;
  }

  const clean = (val) => (val || '').trim().toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s+/i, '');

  const uName = clean(user.name);
  const uEmail = clean(user.email);

  const rDept = (request.resp || request.department || '').trim().toUpperCase();
  const rPerson = clean(request.resp_person);
  const rPersonEmail = clean(request.resp_person_email);

  const personList = rPerson.split(',').map((s) => clean(s)).filter(Boolean);
  const emailList = rPersonEmail.split(',').map((s) => clean(s)).filter(Boolean);

  // If specific assigned person(s) are designated, the user MUST be one of those assigned persons
  if (personList.length > 0 || emailList.length > 0) {
    return Boolean(
      (uName && (rPerson === uName || personList.includes(uName))) ||
      (uEmail && (rPersonEmail === uEmail || emailList.includes(uEmail)))
    );
  }

  // If no specific person was assigned in the field, check if user's department matches
  const isDeptMatch = Boolean(rDept && userDept && userDept === rDept);
  if (!isDeptMatch) return false;

  // The creator who raised it should not see it in approvals unless specifically assigned
  const rCreatedBy = clean(request.created_by);
  const rCreatedEmail = clean(request.created_by_email);
  const rCreatedId = String(request.created_by_id || '');
  const uId = String(user.id || '');

  const isCreator = Boolean(
    (uId && rCreatedId && rCreatedId === uId) ||
    (uName && rCreatedBy && (rCreatedBy === uName || uName === rCreatedBy)) ||
    (uEmail && rCreatedEmail && rCreatedEmail === uEmail)
  );

  return !isCreator;
};

export const isIhlrRequestVisibleToUser = (request, user) => {
  if (!request) return false;
  if (!user) return false;

  const userRole = (user.role || '').trim().toUpperCase();
  const userDept = (user.department || '').trim().toUpperCase();

  // Admin & QAD have universal plant-wide access
  if (userRole === 'ADMIN' || userDept === 'QAD') {
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
