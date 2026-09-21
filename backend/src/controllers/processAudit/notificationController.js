import { successResponse } from '../../utils/response.js';

export const getNotifications = async (req, res) => {
  const notifications = [
    {
      id: 1,
      title: 'Request Approved Successfully',
      message: 'Request REQ-1004 has received final approval from Plant Head (Mr. Anand) and is completed.',
      date: '02 Sep 2026, 10:00 AM',
      read: false,
    },
    {
      id: 2,
      title: 'Request Rejected',
      message: 'Request REQ-1005 was rejected by Mr. Raj due to tolerance deviation. View notes for action.',
      date: '03 Sep 2026, 08:30 AM',
      read: false,
    },
  ];
  return successResponse(res, notifications);
};
