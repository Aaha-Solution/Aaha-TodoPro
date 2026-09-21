import React from 'react';
import { useNavigate } from 'react-router-dom';

const EditUser = () => {
  const navigate = useNavigate();
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <h2 className="text-lg font-bold text-slate-900">Edit User Permissions</h2>
      <p className="text-xs text-slate-500 mb-4">Modify roles and line audit privileges.</p>
      <button onClick={() => navigate('/process-audit/users')} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl">
        Back to Users
      </button>
    </div>
  );
};

export default EditUser;
