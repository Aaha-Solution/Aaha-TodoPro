import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  Check,
  Building2,
  Mail,
  Lock,
  Sparkles,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import {
  setUsers,
  addUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} from '../../redux/slices/userSlice';
import { userService } from '../../services/userService';
import { DEPARTMENTS } from '../../utils/constants';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { storage } from '../../utils/storage';

const ROLES = [
  'ADMIN',
  'USER'
];

const UserManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const isIhlr = location.pathname.startsWith('/ihlr');
  const { user: currentAuthUser, login: updateAuthUser, token: currentAuthToken } = useAuth();
  const { alert: modalAlert, confirm: modalConfirm, error: modalError, warning: modalWarning } = useModal();
  const { users } = useSelector((state) => state.user);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Viewport breakpoint state for mobile/tablet responsive handling
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal]);

  // Form State for Add User
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: 'USER',
    department: 'PRODUCTION',
    status: 'Active',
    systems: ['processAudit', 'ihlr', 'tryOutStatus'],
    password: ''
  });

  const isAddEmpDuplicate = Boolean(
    formData.employeeId?.trim() &&
    users.some(
      (u) =>
        (u.employeeId || u.employee_id || String(u.id)).trim().toLowerCase() ===
        formData.employeeId.trim().toLowerCase()
    )
  );

  const isEditEmpDuplicate = Boolean(
    editingUser?.employeeId?.trim() &&
    users.some(
      (u) =>
        String(u.id) !== String(editingUser.id) &&
        (u.employeeId || u.employee_id || String(u.id)).trim().toLowerCase() ===
          editingUser.employeeId.trim().toLowerCase()
    )
  );

  // Field-level inline errors
  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  // Load users from backend / local storage on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await userService.getUsers();
        dispatch(setUsers(data));
      } catch (err) {
        console.error('Failed to load users from DB:', err);
      }
    };
    fetchUsers();

    // If query string has ?action=new, open add modal directly
    if (searchParams.get('action') === 'new') {
      handleOpenAddModal();
    }
  }, [dispatch, searchParams]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAddModal = () => {
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      role: 'USER',
      department: 'PRODUCTION',
      status: 'Active',
      systems: ['processAudit', 'ihlr', 'tryOutStatus'],
      password: ''
    });
    setAddFormErrors({});
    setShowAddModal(true);
  };

  const handleDepartmentChange = (newDept) => {
    const isQad = (newDept || '').trim().toUpperCase() === 'QAD';
    setFormData((prev) => ({
      ...prev,
      department: newDept,
      role: isQad ? 'ADMIN' : 'USER',
    }));
  };

  const handleRoleChange = (newRole) => {
    const isAdmin = (newRole || '').trim().toUpperCase() === 'ADMIN';
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      department: isAdmin ? 'QAD' : (prev.department === 'QAD' ? 'PRODUCTION' : prev.department),
    }));
  };

  const handleEditDepartmentChange = (newDept) => {
    const isQad = (newDept || '').trim().toUpperCase() === 'QAD';
    setEditingUser((prev) => ({
      ...prev,
      department: newDept,
      role: isQad ? 'ADMIN' : 'USER',
    }));
  };

  const handleEditRoleChange = (newRole) => {
    const isAdmin = (newRole || '').trim().toUpperCase() === 'ADMIN';
    setEditingUser((prev) => ({
      ...prev,
      role: newRole,
      department: isAdmin ? 'QAD' : (prev.department === 'QAD' ? 'PRODUCTION' : prev.department),
    }));
  };

  const validateAddForm = () => {
    const errs = {};
    const trimmedName = (formData.name || '').trim();
    const trimmedEmpId = (formData.employeeId || '').trim();
    const trimmedEmail = (formData.email || '').trim();
    const trimmedPass = (formData.password || '').trim();

    if (!trimmedName) {
      errs.name = 'Full Name is required';
    }

    if (!trimmedEmpId) {
      errs.employeeId = 'Employee ID is required';
    } else if (
      users.some(
        (u) =>
          (u.employeeId || u.employee_id || String(u.id)).trim().toLowerCase() ===
          trimmedEmpId.toLowerCase()
      )
    ) {
      errs.employeeId = `Employee ID "${trimmedEmpId}" is already in DB`;
    }

    if (!trimmedEmail) {
      errs.email = 'Enterprise Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please enter a valid enterprise email address';
    } else if (
      users.some((u) => (u.email || '').trim().toLowerCase() === trimmedEmail.toLowerCase())
    ) {
      errs.email = `Email "${trimmedEmail}" is already registered in DB`;
    }

    if (!trimmedPass) {
      errs.password = 'Password is required';
    } else if (trimmedPass.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setAddFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) {
      return;
    }

    const trimmedEmpId = (formData.employeeId || '').trim();
    const trimmedName = (formData.name || '').trim();
    const trimmedEmail = (formData.email || '').trim().toLowerCase();
    const trimmedPass = (formData.password || '').trim();

    try {
      const created = await userService.createUser({
        ...formData,
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPass,
        employeeId: trimmedEmpId
      });
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));
      setShowAddModal(false);
      setAddFormErrors({});
      showToast(`User "${created?.name || formData.name}" created successfully in Database!`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (msg.toLowerCase().includes('employee id') || msg.toLowerCase().includes('employee_id')) {
        setAddFormErrors((prev) => ({ ...prev, employeeId: msg }));
      } else if (msg.toLowerCase().includes('email')) {
        setAddFormErrors((prev) => ({ ...prev, email: msg }));
      } else {
        modalError('Failed to save user in DB: ' + msg);
      }
    }
  };

  const handleOpenEditModal = (userToEdit) => {
    setEditingUser({
      ...userToEdit,
      originalDepartment: userToEdit.department,
      hasData: Boolean(userToEdit.hasData),
      employeeId: userToEdit.employeeId || userToEdit.employee_id || String(userToEdit.id),
      password: '',
      status: (userToEdit.status && userToEdit.status.toUpperCase() === 'INACTIVE') ? 'Inactive' : 'Active'
    });
    setEditFormErrors({});
    setShowEditPassword(false);
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    const errs = {};
    const trimmedName = (editingUser?.name || '').trim();
    const trimmedEmpId = (editingUser?.employeeId || '').trim();
    const trimmedPass = (editingUser?.password || '').trim();

    if (!trimmedName) {
      errs.name = 'Full Name is required';
    }

    if (!trimmedEmpId) {
      errs.employeeId = 'Employee ID is required';
    } else if (
      users.some(
        (u) =>
          String(u.id) !== String(editingUser.id) &&
          (u.employeeId || u.employee_id || String(u.id)).trim().toLowerCase() ===
            trimmedEmpId.toLowerCase()
      )
    ) {
      errs.employeeId = `Employee ID "${trimmedEmpId}" already taken by another user`;
    }

    if (
      editingUser.hasData &&
      editingUser.originalDepartment &&
      editingUser.department !== editingUser.originalDepartment
    ) {
      errs.department = 'Cannot change department (user has existing records).';
    }

    if (trimmedPass && trimmedPass.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setEditFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!validateEditForm()) {
      return;
    }

    const trimmedEmpId = (editingUser.employeeId || '').trim();
    const trimmedName = (editingUser.name || '').trim();

    try {
      const payload = {
        name: trimmedName,
        employeeId: trimmedEmpId,
        role: editingUser.role,
        department: editingUser.department,
        status: editingUser.status
      };
      if (editingUser.password && editingUser.password.trim()) {
        payload.password = editingUser.password.trim();
      }

      await userService.updateUser(editingUser.id, payload);
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));

      // If updating the currently active session user, refresh auth session immediately
      if (
        String(currentAuthUser?.id) === String(editingUser.id) ||
        (currentAuthUser?.email && currentAuthUser.email.toLowerCase() === editingUser.email?.toLowerCase())
      ) {
        updateAuthUser(
          {
            ...currentAuthUser,
            name: editingUser.name,
            role: (editingUser.role || 'USER').toUpperCase().replace(/\s+/g, '_'),
            department: editingUser.department
          },
          currentAuthToken || storage.getToken() || 'active-session-token'
        );
      }

      setShowEditModal(false);
      setEditFormErrors({});
      showToast(
        payload.password
          ? `User "${editingUser.name}" details and password updated successfully in Database!`
          : `User "${editingUser.name}" updated successfully in Database!`
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (msg.toLowerCase().includes('employee id') || msg.toLowerCase().includes('employee_id')) {
        setEditFormErrors((prev) => ({ ...prev, employeeId: msg }));
      } else if (msg.toLowerCase().includes('department')) {
        setEditFormErrors((prev) => ({ ...prev, department: msg }));
      } else {
        modalError('Failed to update user in DB: ' + msg);
      }
    }
  };

  const handleDelete = async (userId, userName) => {
    const isSelf =
      (currentAuthUser?.id && String(currentAuthUser.id) === String(userId)) ||
      (currentAuthUser?.email && users.find((u) => String(u.id) === String(userId))?.email?.toLowerCase() === currentAuthUser.email.toLowerCase());

    if (isSelf) {
      modalError('You cannot delete your own logged-in user account.');
      return;
    }

    const isConfirmed = await modalConfirm(`Are you sure you want to delete user "${userName}" from the database?`);
    if (isConfirmed) {
      try {
        await userService.deleteUser(userId);
        const freshData = await userService.getUsers();
        dispatch(setUsers(freshData));
        showToast(`User "${userName}" was deleted from Database.`);
      } catch (err) {
        modalError('Failed to delete user from DB: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleToggleStatus = async (userItem) => {
    const newStatus = (userItem.status === 'Active' || userItem.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
    try {
      await userService.updateUser(userItem.id, { ...userItem, status: newStatus });
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));
      showToast(`Status updated to ${newStatus} for ${userItem.name}`);
    } catch (err) {
      modalError('Failed to toggle status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSwitchActiveUser = (targetUser) => {
    updateAuthUser(
      {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role.toUpperCase().replace(/\s+/g, '_'),
        department: targetUser.department
      },
      'switched-token'
    );
    showToast(`Switched active session to: ${targetUser.name} (${targetUser.role})`);
  };

  // Filter logic - users are common for all tabs
  const filteredUsers = users.filter((u) => {
    const userEmpId = String(u.employeeId || u.employee_id || u.id || '');
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      userEmpId.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id)?.toLowerCase().includes(search.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || u.department === selectedDept;
    const matchesRole = selectedRole === 'ALL' || (u.role && u.role.toLowerCase() === selectedRole.toLowerCase());
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'Active' && (u.status === 'Active' || u.status === 'ACTIVE')) ||
      (selectedStatus === 'Inactive' && (u.status === 'Inactive' || u.status === 'INACTIVE'));

    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  // KPI Metrics - Unified for all tabs
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.status === 'Active' || u.status === 'ACTIVE').length;
  const adminCount = users.filter((u) => (u.role || '').toLowerCase() === 'admin').length;
  const standardUserCount = users.filter((u) => (u.role || '').toLowerCase() === 'user').length;
  const userDept = (currentAuthUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isQad = userDept === 'QAD';
  const isAdmin = currentAuthUser?.role?.toUpperCase() === 'ADMIN' || isQad;

  // Helper to convert public image assets to Base64 for jsPDF embedding
  const getBase64ImageFromUrl = async (imageUrl) => {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Failed to load image for PDF:', err);
      return null;
    }
  };

  // Export to PDF (.pdf) with Company Logo
  const handleExportPdf = async () => {
    if (!filteredUsers || filteredUsers.length === 0) {
      modalWarning('No data available to export. Please adjust your filters or search criteria.', 'No Data Available');
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const today = formatDateDDMMYYYY(new Date());

      // Fetch and embed official INEL logo
      let logoData = null;
      try {
        logoData = await getBase64ImageFromUrl('/images/logo.png');
      } catch (e) {
        console.warn('Logo could not be loaded:', e);
      }

      let textStartX = 40;
      if (logoData) {
        try {
          doc.addImage(logoData, 'PNG', 40, 18, 46, 46);
          textStartX = 96;
        } catch (imgErr) {
          console.warn('Could not add logo to PDF:', imgErr);
        }
      }

      // Top Title and Company Branding
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('INDIA NIPPON ELECTRICALS LIMITED', textStartX, 35);

      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text('Enterprise User Directory & Access Management Report', textStartX, 51);

      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Generated: ${today} | Total Directory Users: ${totalCount} | Filtered Records: ${filteredUsers.length} | Active: ${activeCount} | Admins: ${adminCount} | Dept: ${selectedDept} | Role: ${selectedRole} | Status: ${selectedStatus}`,
        40,
        76
      );

      const tableHeaders = [
        ['SL', 'NAME', 'EMAIL', 'EMPLOYEE ID', 'ROLE', 'DEPARTMENT', 'SYSTEM ACCESS', 'STATUS']
      ];

      const tableRows = filteredUsers.map((u, idx) => [
        idx + 1,
        u.name || '—',
        u.email || '—',
        String(u.employeeId || u.employee_id || u.id || '—'),
        (u.role || 'USER').toUpperCase(),
        u.department || '—',
        Array.isArray(u.systems) && u.systems.length > 0 
          ? u.systems.map(s => s === 'processAudit' ? 'Process Audit' : s === 'ihlr' ? 'IHLR' : s === 'tryOutStatus' ? 'Try Out' : s).join(', ')
          : 'Process Audit, IHLR, Try Out',
        (u.status || 'Active').toUpperCase()
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 86,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 120, fontStyle: 'bold' },
          2: { cellWidth: 150 },
          3: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 65, halign: 'center' },
          5: { cellWidth: 120 },
          6: { cellWidth: 130 },
          7: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.width - 80,
            doc.internal.pageSize.height - 20
          );
          doc.text(
            'Confidential - India Nippon Electricals Limited Enterprise Management System',
            40,
            doc.internal.pageSize.height - 20
          );
        }
      });

      doc.save(`User_Management_Directory_${today.replace(/\//g, '-')}.pdf`);
      showToast(`User directory PDF exported successfully (${filteredUsers.length} records)`);
    } catch (err) {
      console.error('Failed to export users to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          User Management is restricted to Administrators only. You do not have permissions to access enterprise user directory and access settings.
        </p>
        <button
          onClick={() => navigate(isIhlr ? '/ihlr/dashboard' : '/process-audit/dashboard')}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        paddingBottom: isMobile ? '32px' : '64px',
        boxSizing: 'border-box'
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '12px',
            maxWidth: isMobile ? 'calc(100vw - 32px)' : '400px'
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" style={{ width: '16px', height: '16px' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Actions Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '12px' : '16px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/images/logo.png"
              alt="INEL Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
              style={{
                width: isMobile ? '30px' : '36px',
                height: isMobile ? '30px' : '36px',
                flexShrink: 0
              }}
            />
            <h1
              className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight"
              style={{
                fontSize: isMobile ? '20px' : isTablet ? '24px' : '28px',
                lineHeight: isMobile ? '26px' : isTablet ? '30px' : '34px',
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.025em',
                margin: 0
              }}
            >
              Enterprise User Management
            </h1>
          </div>
        </div>

        <div
          className="flex items-center gap-3"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            width: isMobile ? '100%' : 'auto',
            boxSizing: 'border-box'
          }}
        >
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
            style={{
              height: '38px',
              padding: isMobile ? '0 12px' : '0 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              flex: isMobile ? 1 : 'initial',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            title="Export User Directory as PDF"
            id="export-users-pdf-header-btn"
          >
            <Download className="w-4 h-4 text-blue-600" style={{ width: '16px', height: '16px' }} />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            style={{
              height: '38px',
              padding: isMobile ? '0 14px' : '0 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              flex: isMobile ? 1 : 'initial',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
          >
            <UserPlus className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip - Common across all tabs */}
      <div
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: isMobile ? '10px' : '16px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <div
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs"
          style={{
            padding: isMobile ? '12px' : '16px',
            borderRadius: '14px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center justify-between mb-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 700 }}>Total Users</span>
            <Users className="w-4 h-4 text-slate-400" style={{ width: '16px', height: '16px' }} />
          </div>
          <p className="text-2xl font-extrabold text-slate-900" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, margin: 0, color: '#0f172a' }}>{totalCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontSize: '10px', marginTop: '2px', color: '#94a3b8' }}>Common to all portals</p>
        </div>

        <div
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs"
          style={{
            padding: isMobile ? '12px' : '16px',
            borderRadius: '14px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center justify-between mb-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 700 }}>Active Users</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" style={{ width: '16px', height: '16px' }} />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, margin: 0, color: '#059669' }}>{activeCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontSize: '10px', marginTop: '2px', color: '#94a3b8' }}>{totalCount - activeCount} inactive users</p>
        </div>

        <div
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs"
          style={{
            padding: isMobile ? '12px' : '16px',
            borderRadius: '14px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center justify-between mb-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 700 }}>Admin Users</span>
            <Shield className="w-4 h-4 text-indigo-600" style={{ width: '16px', height: '16px' }} />
          </div>
          <p className="text-2xl font-extrabold text-indigo-700" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, margin: 0, color: '#4338ca' }}>{adminCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontSize: '10px', marginTop: '2px', color: '#94a3b8' }}>Full administrative access</p>
        </div>

        <div
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs"
          style={{
            padding: isMobile ? '12px' : '16px',
            borderRadius: '14px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center justify-between mb-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 700 }}>Standard Users</span>
            <Users className="w-4 h-4 text-blue-600" style={{ width: '16px', height: '16px' }} />
          </div>
          <p className="text-2xl font-extrabold text-blue-700" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, margin: 0, color: '#1d4ed8' }}>{standardUserCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontSize: '10px', marginTop: '2px', color: '#94a3b8' }}>Universal tabs access</p>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '14px' : '16px',
          padding: isMobile ? '12px' : '16px',
          border: '1px solid #e2e8f0',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(12, minmax(0, 1fr))',
            gap: isMobile ? '10px' : '12px',
            alignItems: 'center',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {/* Search */}
          <div
            className="md:col-span-5 relative"
            style={{
              gridColumn: isMobile ? '1 / -1' : isTablet ? '1 / -1' : 'span 5 / span 5',
              position: 'relative',
              minWidth: 0
            }}
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" style={{ width: '16px', height: '16px', left: '12px', top: '11px' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user name, email, or employee ID..."
              style={{
                height: '38px',
                paddingLeft: '38px',
                paddingRight: '14px',
                borderRadius: '10px',
                fontSize: isMobile ? '13px' : '12px',
                boxSizing: 'border-box'
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition outline-none"
            />
          </div>

          {/* Department Filter */}
          <div
            className="md:col-span-3"
            style={{
              gridColumn: isMobile ? '1 / -1' : isTablet ? 'span 1 / span 1' : 'span 3 / span 3',
              minWidth: 0
            }}
          >
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: isMobile ? '13px' : '12px',
                boxSizing: 'border-box'
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div
            className="md:col-span-2"
            style={{
              gridColumn: isMobile ? '1 / -1' : isTablet ? 'span 1 / span 1' : 'span 2 / span 2',
              minWidth: 0
            }}
          >
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: isMobile ? '13px' : '12px',
                boxSizing: 'border-box'
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Status Filter & Reset */}
          <div
            className="md:col-span-2 flex items-center gap-2"
            style={{
              gridColumn: isMobile ? '1 / -1' : isTablet ? 'span 2 / span 2' : 'span 2 / span 2',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0
            }}
          >
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: isMobile ? '13px' : '12px',
                boxSizing: 'border-box',
                flex: 1
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            {(search || selectedDept !== 'ALL' || selectedRole !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedDept('ALL');
                  setSelectedRole('ALL');
                  setSelectedStatus('ALL');
                }}
                style={{
                  height: '38px',
                  width: '38px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '14px' : '16px',
          border: '1px solid #e2e8f0',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <div
          className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"
          style={{
            padding: isMobile ? '12px 14px' : '16px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center gap-2.5" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: 800, margin: 0 }}>
              Enterprise Users Directory
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px' }}>
              {filteredUsers.length} Users
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs text-slate-400" style={{ fontSize: '12px' }}>
              Showing filtered results
            </div>
          </div>
        </div>

        <div
          className="overflow-x-auto"
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxSizing: 'border-box'
          }}
        >
          <table
            className="w-full text-left border-collapse"
            style={{
              minWidth: isMobile ? '680px' : '750px',
              width: '100%'
            }}
          >
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500" style={{ fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                <th className="py-3.5 px-4 text-center w-16" style={{ padding: '12px 16px', textAlign: 'center', width: '64px' }}>SL NO</th>
                <th className="py-3.5 px-6" style={{ padding: '12px 24px' }}>USER &amp; DETAILS</th>
                <th className="py-3.5 px-4" style={{ padding: '12px 16px' }}>EMPLOYEE ID</th>
                <th className="py-3.5 px-4" style={{ padding: '12px 16px' }}>ROLE</th>
                <th className="py-3.5 px-4" style={{ padding: '12px 16px' }}>DEPARTMENT</th>
                <th className="py-3.5 px-4" style={{ padding: '12px 16px' }}>TABS &amp; SCOPE</th>
                <th className="py-3.5 px-4" style={{ padding: '12px 16px' }}>STATUS</th>
                <th className="py-3.5 px-6 text-right" style={{ padding: '12px 24px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs" style={{ fontSize: '12px' }}>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400" style={{ padding: '48px 16px', textAlign: 'center' }}>
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" style={{ width: '32px', height: '32px', margin: '0 auto 8px auto' }} />
                    <p className="font-semibold text-slate-600" style={{ fontSize: '13px', margin: 0 }}>No personnel found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontSize: '11px', marginTop: '2px' }}>Try refining your search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  const isCurrent =
                    (currentAuthUser?.id && String(currentAuthUser.id) === String(u.id)) ||
                    (currentAuthUser?.email && u.email && currentAuthUser.email.toLowerCase() === u.email.toLowerCase());

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* SL NO */}
                      <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500" style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {index + 1}
                      </td>

                      {/* User Column */}
                      <td className="py-4 px-6" style={{ padding: '14px 24px' }}>
                        <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shadow-2xs shrink-0" style={{ width: '36px', height: '36px', borderRadius: '9999px', flexShrink: 0, fontSize: '12px', fontWeight: 800 }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="font-bold text-slate-900" style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold" style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono block" style={{ fontSize: '11px', color: '#94a3b8' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-4 px-4 font-mono font-bold text-slate-700" style={{ padding: '14px 16px' }}>
                        {u.employeeId || u.employee_id || u.id}
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4" style={{ padding: '14px 16px' }}>
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                            u.role?.toLowerCase() === 'admin'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '9999px' }}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-4 text-slate-700 font-medium" style={{ padding: '14px 16px' }}>
                        {u.department}
                      </td>

                      {/* Tabs & Access Scope */}
                      <td className="py-4 px-4 whitespace-nowrap" style={{ padding: '14px 16px' }}>
                        <div className="flex flex-wrap items-center gap-1" style={{ gap: '4px' }}>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200" style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px' }} title="Process Audit Observation tabs">
                            Process Audit
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px' }} title="In-House Line Rejection tabs">
                            IHLR
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200" style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px' }} title="Try Out Status tabs">
                            Try Out
                          </span>
                        </div>
                      </td>

                      {/* Status (Read-Only) */}
                      <td className="py-4 px-4" style={{ padding: '14px 16px' }}>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border select-none cursor-default ${
                            u.status === 'Active' || u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' || u.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} style={{ width: '6px', height: '6px', borderRadius: '9999px' }} />
                          <span>{u.status || 'Active'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right" style={{ padding: '14px 24px', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Edit User */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                            style={{ padding: '6px', borderRadius: '8px' }}
                            title="Edit user details and roles"
                          >
                            <Edit2 className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
                          </button>

                          {/* Delete User - Hidden for Current Logged-In User */}
                          {!isCurrent && (
                            <button
                              onClick={() => handleDelete(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition shadow-2xs cursor-pointer"
                              style={{ padding: '6px', borderRadius: '8px' }}
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal &&
        createPortal(
          <div 
            className="fixed inset-0 !m-0 !mt-0 z-[99990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
            style={{
              padding: isMobile ? '8px' : '16px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddModal(false);
            }}
          >
            <div
              className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col overflow-hidden"
              style={{
                borderRadius: isMobile ? '16px' : '24px',
                width: isMobile ? 'calc(100vw - 16px)' : '100%',
                maxWidth: '520px',
                maxHeight: isMobile ? 'calc(100dvh - 20px)' : '90vh',
                margin: 'auto',
                boxSizing: 'border-box'
              }}
            >
              <form noValidate onSubmit={handleCreateUserSubmit} className="flex flex-col h-full min-h-0 flex-1 overflow-hidden" style={{ margin: 0 }}>
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white" style={{ padding: isMobile ? '14px 16px' : '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2.5" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserPlus className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900" style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add New Enterprise User</h3>
                      <p className="text-[11px] text-slate-400" style={{ fontSize: '11px', margin: '2px 0 0 0', color: '#94a3b8' }}>Assign role and system authorization</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                    style={{ padding: '6px', borderRadius: '8px' }}
                  >
                    <X className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4" style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                      gap: isMobile ? '12px' : '16px'
                    }}
                  >
                  {/* Full Name */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (addFormErrors.name) setAddFormErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      placeholder="e.g. Ramesh Kumar"
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 focus:bg-white focus:ring-2 outline-none transition ${
                        addFormErrors.name
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {addFormErrors.name && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{addFormErrors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Employee ID */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Employee ID *
                    </label>
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => {
                        setFormData({ ...formData, employeeId: e.target.value });
                        if (addFormErrors.employeeId) setAddFormErrors((prev) => ({ ...prev, employeeId: '' }));
                      }}
                      placeholder="e.g. USR-008"
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 font-mono focus:bg-white focus:ring-2 outline-none transition ${
                        addFormErrors.employeeId || isAddEmpDuplicate
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {(addFormErrors.employeeId || isAddEmpDuplicate) && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{addFormErrors.employeeId || `Employee ID "${formData.employeeId}" is already registered.`}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Address */}
                <div style={{ minWidth: 0 }}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                    Enterprise Email *
                  </label>
                  <div className="relative" style={{ position: 'relative' }}>
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" style={{ width: '16px', height: '16px', left: '12px', top: '11px' }} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (addFormErrors.email) setAddFormErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      placeholder="ramesh@inel.co.in"
                      style={{
                        height: '38px',
                        paddingLeft: '38px',
                        paddingRight: '12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 focus:bg-white focus:ring-2 outline-none transition ${
                        addFormErrors.email
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {addFormErrors.email && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                      <span>{addFormErrors.email}</span>
                    </p>
                  )}
                </div>

                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}
                >
                  {/* Department (First) */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Department *
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role (Second) */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Operational Role *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Initial Password & Status */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Password *
                    </label>
                    <div className="relative" style={{ position: 'relative' }}>
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" style={{ width: '16px', height: '16px', left: '12px', top: '11px' }} />
                      <input
                        type={showAddPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          if (addFormErrors.password) setAddFormErrors((prev) => ({ ...prev, password: '' }));
                        }}
                        placeholder="Enter password"
                        style={{
                          height: '38px',
                          paddingLeft: '38px',
                          paddingRight: '38px',
                          borderRadius: '10px',
                          fontSize: isMobile ? '13px' : '12px',
                          boxSizing: 'border-box'
                        }}
                        className={`w-full bg-slate-50 border text-slate-800 focus:bg-white focus:ring-2 outline-none transition ${
                          addFormErrors.password
                            ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                            : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword(!showAddPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5"
                        style={{ right: '10px', top: '9px', padding: '2px' }}
                        title={showAddPassword ? "Hide password" : "Show password"}
                      >
                        {showAddPassword ? <EyeOff className="w-4 h-4" style={{ width: '16px', height: '16px' }} /> : <Eye className="w-4 h-4" style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                    {addFormErrors.password && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{addFormErrors.password}</span>
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Account Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value="Active">Active</option>
                    </select>
                  </div>
                </div>

                {/* Universal Tab Permissions Info */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5" style={{ padding: '12px', borderRadius: '12px' }}>
                  <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider" style={{ fontSize: '11px' }}>
                    Universal Tab Scope (Active for all portals)
                  </span>
                  <p className="text-[11px] text-slate-500" style={{ fontSize: '11px', margin: '2px 0 6px 0' }}>
                    This enterprise user will automatically have access to all tabs across all portals.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5" style={{ gap: '6px' }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-blue-600" style={{ width: '12px', height: '12px' }} /> Process Audit
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-indigo-600" style={{ width: '12px', height: '12px' }} /> IHLR Defect Tracking
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-amber-600" style={{ width: '12px', height: '12px' }} /> Try Out Trials
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Actions */}
              <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50/70 shrink-0 flex gap-2.5 sm:gap-3" style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  className="flex-1 px-4 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                  className="flex-1 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Save &amp; Add User
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* EDIT USER MODAL */}
      {showEditModal && editingUser &&
        createPortal(
          <div 
            className="fixed inset-0 !m-0 !mt-0 z-[99990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
            style={{
              padding: isMobile ? '8px' : '16px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEditModal(false);
            }}
          >
            <div
              className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col overflow-hidden"
              style={{
                borderRadius: isMobile ? '16px' : '24px',
                width: isMobile ? 'calc(100vw - 16px)' : '100%',
                maxWidth: '520px',
                maxHeight: isMobile ? 'calc(100dvh - 20px)' : '90vh',
                margin: 'auto',
                boxSizing: 'border-box'
              }}
            >
              <form noValidate onSubmit={handleEditUserSubmit} className="flex flex-col h-full min-h-0 flex-1 overflow-hidden" style={{ margin: 0 }}>
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white" style={{ padding: isMobile ? '14px 16px' : '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2.5" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900" style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Edit User Details</h3>
                      <p className="text-[11px] text-slate-400" style={{ fontSize: '11px', margin: '2px 0 0 0', color: '#94a3b8' }}>Update personnel profile &amp; employee ID</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                    style={{ padding: '6px', borderRadius: '8px' }}
                  >
                    <X className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4" style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                      gap: isMobile ? '12px' : '16px'
                    }}
                  >
                  {/* Full Name */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => {
                        setEditingUser({ ...editingUser, name: e.target.value });
                        if (editFormErrors.name) setEditFormErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 focus:bg-white focus:ring-2 outline-none transition ${
                        editFormErrors.name
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {editFormErrors.name && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{editFormErrors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Employee ID (Editable & Validated) */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Employee ID *
                    </label>
                    <input
                      type="text"
                      value={editingUser.employeeId || ''}
                      onChange={(e) => {
                        setEditingUser({ ...editingUser, employeeId: e.target.value });
                        if (editFormErrors.employeeId) setEditFormErrors((prev) => ({ ...prev, employeeId: '' }));
                      }}
                      placeholder="e.g. USR-008"
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 font-mono focus:bg-white focus:ring-2 outline-none transition ${
                        editFormErrors.employeeId || isEditEmpDuplicate
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {(editFormErrors.employeeId || isEditEmpDuplicate) && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{editFormErrors.employeeId || `Employee ID "${editingUser.employeeId}" is already taken by another user.`}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between" style={{ fontSize: '11px', marginBottom: '4px' }}>
                    <span>Enterprise Email</span>
                    <span className="text-[10px] text-slate-400 lowercase font-medium tracking-normal">(cannot be modified)</span>
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingUser.email}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      fontSize: isMobile ? '13px' : '12px',
                      boxSizing: 'border-box'
                    }}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed outline-none select-none font-medium"
                  />
                </div>

                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}
                >
                  {/* Department (First) */}
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center justify-between mb-1" style={{ marginBottom: '4px' }}>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700" style={{ fontSize: '11px' }}>
                        Department *
                      </label>
                      {editingUser.hasData && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200" style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                          <Lock className="w-3 h-3 text-amber-600" style={{ width: '12px', height: '12px' }} /> Locked
                        </span>
                      )}
                    </div>
                    <select
                      value={editingUser.department}
                      disabled={editingUser.hasData}
                      onChange={(e) => handleEditDepartmentChange(e.target.value)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full border text-xs text-slate-800 outline-none transition ${
                        editingUser.hasData
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none font-medium'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                      }`}
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    {editingUser.hasData && (
                      <p className="text-[10px] text-amber-600 mt-1 font-medium" style={{ fontSize: '10px', marginTop: '2px' }}>
                        Cannot be modified (has existing records).
                      </p>
                    )}
                    {editFormErrors.department && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                        <span>{editFormErrors.department}</span>
                      </p>
                    )}
                  </div>

                  {/* Role (Second) */}
                  <div style={{ minWidth: 0 }}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                      Operational Role *
                    </label>
                    <select
                      value={editingUser.role ? editingUser.role.toUpperCase() : 'USER'}
                      onChange={(e) => handleEditRoleChange(e.target.value)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1" style={{ fontSize: '11px', marginBottom: '4px' }}>
                    Account Status
                  </label>
                  <select
                    value={editingUser.status && editingUser.status.toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      fontSize: isMobile ? '13px' : '12px',
                      boxSizing: 'border-box'
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Password & Update Password Field */}
                <div style={{ minWidth: 0 }}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between" style={{ fontSize: '11px', marginBottom: '4px' }}>
                    <span>Password</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Leave blank to keep unchanged)
                    </span>
                  </label>
                  <div className="relative" style={{ position: 'relative' }}>
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" style={{ width: '16px', height: '16px', left: '12px', top: '11px' }} />
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editingUser.password || ''}
                      onChange={(e) => {
                        setEditingUser({ ...editingUser, password: e.target.value });
                        if (editFormErrors.password) setEditFormErrors((prev) => ({ ...prev, password: '' }));
                      }}
                      placeholder="Enter new password to update..."
                      style={{
                        height: '38px',
                        paddingLeft: '38px',
                        paddingRight: '38px',
                        borderRadius: '10px',
                        fontSize: isMobile ? '13px' : '12px',
                        boxSizing: 'border-box'
                      }}
                      className={`w-full bg-slate-50 border text-slate-800 focus:bg-white focus:ring-2 outline-none transition ${
                        editFormErrors.password
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5"
                      style={{ right: '10px', top: '9px', padding: '2px' }}
                      title={showEditPassword ? "Hide password" : "Show password"}
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" style={{ width: '16px', height: '16px' }} /> : <Eye className="w-4 h-4" style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                  {editFormErrors.password && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150" style={{ fontSize: '11px', marginTop: '4px' }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" style={{ width: '14px', height: '14px' }} />
                      <span>{editFormErrors.password}</span>
                    </p>
                  )}
                  {editingUser.password && !editFormErrors.password && (
                    <p className="text-[10px] text-blue-600 font-medium mt-1 flex items-center gap-1" style={{ fontSize: '10px', marginTop: '4px' }}>
                      <Sparkles className="w-3 h-3" style={{ width: '12px', height: '12px' }} /> New password will be saved upon clicking "Save Changes"
                    </p>
                  )}
                </div>

                {/* Universal Tab Permissions Info */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5" style={{ padding: '12px', borderRadius: '12px' }}>
                  <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider" style={{ fontSize: '11px' }}>
                    Universal Tab Scope (Active for all portals)
                  </span>
                  <p className="text-[11px] text-slate-500" style={{ fontSize: '11px', margin: '2px 0 6px 0' }}>
                    Role and department updates will immediately apply across all tabs in all portals.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5" style={{ gap: '6px' }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-blue-600" style={{ width: '12px', height: '12px' }} /> Process Audit
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-indigo-600" style={{ width: '12px', height: '12px' }} /> IHLR Defect Tracking
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      <Check className="w-3 h-3 text-amber-600" style={{ width: '12px', height: '12px' }} /> Try Out Trials
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Actions */}
              <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50/70 shrink-0 flex gap-2.5 sm:gap-3" style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  className="flex-1 px-4 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                  className="flex-1 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
};

export default UserManagement;
