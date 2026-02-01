import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Filter,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MessageBox from '../../components/ui/MessageBox';

const ROLE_FILTERS = [
  { value: 'ALL', label: 'All roles' },
  { value: 'USER', label: 'Users' },
  { value: 'VENDOR', label: 'Transporters' },
  { value: 'ADMIN', label: 'Admins' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending approval' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'REJECTED', label: 'Rejected' },
];

const pageSizeOptions = [10, 25, 50, 100];

const formatDateTime = (value) => {
  if (!value) return '�';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '�';
  }
};

const statusBadge = (user) => {
  const { approvalStatus, isActive } = user;
  if (approvalStatus === 'PENDING') {
    return {
      tone: 'bg-amber-100 text-amber-700 border border-amber-200',
      label: 'Pending approval',
    };
  }
  if (approvalStatus === 'REJECTED') {
    return {
      tone: 'bg-rose-100 text-rose-700 border border-rose-200',
      label: 'Rejected',
    };
  }
  if (!isActive) {
    return {
      tone: 'bg-slate-100 text-slate-600 border border-slate-200',
      label: 'Inactive',
    };
  }
  return {
    tone: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    label: 'Active',
  };
};

const UserManagementPage = () => {
  const { api, user } = useAuth();
  const isPlatformAdmin = user?.role === 'ADMIN';

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [filters, setFilters] = useState({
    role: 'ALL',
    status: 'ALL',
    search: '',
  });
  const [toast, setToast] = useState({ message: '', tone: 'info' });
  const [auditTrail, setAuditTrail] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const pendingAlerts = useMemo(() => stats?.pendingApprovals ?? 0, [stats]);

  const closeToast = useCallback(() => setToast({ message: '', tone: 'info' }), []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await api.get('/admin/users/stats');
      setStats(data.stats);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Failed to load user statistics.',
      });
    } finally {
      setLoadingStats(false);
    }
  }, [api]);

  const fetchUsers = useCallback(async (requestedPage = page, keepLoadingState = false) => {
    if (!keepLoadingState) setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: requestedPage,
        limit: pageSize,
      });

      if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search.trim());

      const { data } = await api.get(`/admin/users?${params.toString()}`);
      setUsers(data.users);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Failed to load users.',
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [api, filters, page, pageSize]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers, pageSize, filters.role, filters.status]);

  const handleSearch = (event) => {
    event.preventDefault();
    fetchUsers(1);
  };

  const updateActionState = (id, value) => {
    setActionLoading((prev) => ({ ...prev, [id]: value }));
  };
  const handleApprove = async (target) => {
    if (!isPlatformAdmin) {
      setToast({ tone: 'warning', message: 'Only platform administrators can approve registrations.' });
      return;
    }
    const note = window.prompt('Add approval note (optional):', '') ?? '';
    updateActionState(target.id, true);
    try {
      await api.post(`/admin/registrations/${target.id}/approve`, { approvalNote: note.trim() || undefined });
      setToast({ tone: 'success', message: `Approved ${target.name}'s access.` });
      fetchStats();
      fetchUsers(page, true);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to approve registration.',
      });
    } finally {
      updateActionState(target.id, false);
    }
  };

  const handleReject = async (target) => {
    if (!isPlatformAdmin) {
      setToast({ tone: 'warning', message: 'Only platform administrators can reject registrations.' });
      return;
    }
    const reason = window.prompt('Enter rejection reason:', '');
    if (!reason) return;
    updateActionState(target.id, true);
    try {
      await api.post(`/admin/registrations/${target.id}/reject`, { reason });
      setToast({ tone: 'warning', message: `${target.name}'s registration rejected.` });
      fetchStats();
      fetchUsers(page, true);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to reject registration.',
      });
    } finally {
      updateActionState(target.id, false);
    }
  };

  const handleToggleActive = async (target) => {
    updateActionState(target.id, true);
    try {
      await api.patch(`/admin/users/${target.id}`, { isActive: !target.isActive });
      setToast({
        tone: target.isActive ? 'warning' : 'success',
        message: target.isActive
          ? `${target.name} was marked inactive.`
          : `${target.name} reactivated.`,
      });
      fetchUsers(page, true);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to update user status.',
      });
    } finally {
      updateActionState(target.id, false);
    }
  };

  const handleResetPassword = async (target) => {
    const confirmation = window.confirm(
      `Generate a temporary password for ${target.name}? They will need to update it after login.`,
    );
    if (!confirmation) return;
    updateActionState(target.id, true);
    try {
      const { data } = await api.post(`/admin/users/${target.id}/reset-password`);
      setToast({
        tone: 'info',
        message: data.temporaryPassword
          ? `Temporary password: ${data.temporaryPassword}`
          : 'Password reset successfully.',
      });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to reset password.',
      });
    } finally {
      updateActionState(target.id, false);
    }
  };

  const openEditor = (target) => {
    setEditDraft({
      id: target.id,
      name: target.name || '',
      email: target.email,
      phone: target.phone || '',
      role: target.role,
      approvalNote: target.approvalNote || '',
      isActive: target.isActive,
    });
  };

  const handleSaveEdit = async () => {
    if (!editDraft) return;
    const { id, name, phone, role, approvalNote, isActive } = editDraft;
    updateActionState(id, true);
    try {
      await api.patch(`/admin/users/${id}`, {
        name,
        phone,
        role,
        approvalNote,
        isActive,
      });
      setToast({ tone: 'success', message: 'User profile updated.' });
      setEditDraft(null);
      fetchUsers(page, true);
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to update user.',
      });
    } finally {
      updateActionState(id, false);
    }
  };

  const openAuditTrail = async (target) => {
    updateActionState(target.id, true);
    try {
      const { data } = await api.get(`/admin/users/${target.id}/audit-log`);
      setAuditTrail({
        user: target,
        entries: data.audits || [],
      });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error.response?.data?.error || 'Unable to fetch audit history.',
      });
    } finally {
      updateActionState(target.id, false);
    }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-6">
      <MessageBox message={toast.message} tone={toast.tone} onClose={closeToast} />

      <header className="rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-200">User intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold">User & Access Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Monitor registrations, manage access, and keep your transporter community compliant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchUsers(page, true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        {isPlatformAdmin && pendingAlerts > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-100/20 px-4 py-3 text-sm text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {pendingAlerts} registration{pendingAlerts === 1 ? '' : 's'} awaiting approval. Jump on it to keep the
              onboarding queue healthy.
            </span>
          </div>
        )}
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loadingStats ? (
          <div className="col-span-full flex h-32 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total users</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{stats?.totalUsers ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">
                {stats?.approvedUsers ?? 0} approved � {stats?.rejectedUsers ?? 0} rejected
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-600">
                <UserCheck className="h-4 w-4" />
                Active in last 30 days
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{stats?.activeUsers ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">Users with recent sign-ins</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-600">
                <ClipboardList className="h-4 w-4" />
                Pending approval
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-600">{stats?.pendingApprovals ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">Need an admin decision</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-600">
                <AlertTriangle className="h-4 w-4" />
                Inactive users
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {(stats?.inactive30 ?? 0) + (stats?.inactive60 ?? 0) + (stats?.inactive90 ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                30d: {stats?.inactive30 ?? 0} � 60d: {stats?.inactive60 ?? 0} � 90d+: {stats?.inactive90 ?? 0}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User directory</h2>
            <p className="text-sm text-slate-500">
              Filter by role, approval status, or chase the ones who haven&apos;t logged in lately.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search name, email, phone"
              className="w-48 bg-transparent px-2 text-sm text-slate-700 focus:outline-none"
            />
          </div>

          <select
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            {ROLE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
          >
            <Search className="h-4 w-4" />
            Apply
          </button>
        </form>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loadingUsers ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No users found. Adjust your filters or search criteria.
                  </td>
                </tr>
              ) : (
                users.map((item) => {
                  const badge = statusBadge(item);
                  const loading = actionLoading[item.id];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white shadow">
                            {item.name ? item.name.charAt(0).toUpperCase() : '@'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.name || 'Unnamed user'}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {item.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.tone}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(item.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {item.approvalStatus === 'PENDING' && isPlatformAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(item)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
                              >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(item)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:opacity-60"
                              >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditor(item)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(item)}
                                disabled={loading}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                                  item.isActive
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }`}
                              >
                                {loading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : item.isActive ? (
                                  <UserMinus className="h-3.5 w-3.5" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}
                                {item.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetPassword(item)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-100 disabled:opacity-60"
                              >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                Reset password
                              </button>
                              <button
                                type="button"
                                onClick={() => openAuditTrail(item)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-60"
                                title="View audit log"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                                Audit
                              </button>
                            </>
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 focus:border-blue-500 focus:outline-none"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchUsers(Math.max(page - 1, 1))}
              disabled={page <= 1}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 disabled:opacity-60"
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchUsers(Math.min(page + 1, totalPages))}
              disabled={page >= totalPages}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {editDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit user profile</h3>
                <p className="text-xs text-slate-500">{editDraft.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              >
                <MoreHorizontal className="h-4 w-4 rotate-90" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Full name</label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Phone</label>
                <input
                  type="tel"
                  value={editDraft.phone}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Role</label>
                <select
                  value={editDraft.role}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, role: event.target.value }))}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {ROLE_FILTERS.filter((option) => option.value !== 'ALL').map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Approval note</label>
                <textarea
                  value={editDraft.approvalNote}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, approvalNote: event.target.value }))}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Visible to other administrators"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editDraft.isActive}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Active account
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" />
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
      {auditTrail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Audit trail</h3>
                <p className="text-xs text-slate-500">{auditTrail.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuditTrail(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              >
                <MoreHorizontal className="h-4 w-4 rotate-90" />
              </button>
            </div>

            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {auditTrail.entries.length === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-slate-500">
                  No audit events recorded yet.
                </li>
              ) : (
                auditTrail.entries.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{entry.action}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(entry.timestamp)}</p>
                    {entry.details && (
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    )}
                    {entry.ipAddress && <p className="mt-2 text-xs text-slate-500">IP: {entry.ipAddress}</p>}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;



