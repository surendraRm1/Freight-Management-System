import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const SuperAdminCompanyUsers = () => {
  const { api } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'USER', password: '' });
  const [error, setError] = useState(null);

  const loadCompanies = useCallback(async () => {
    try {
      const { data } = await api.get('/super-admin/companies');
      setCompanies(data);
      if (!selectedCompany && data.length) {
        setSelectedCompany(data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load companies');
    }
  }, [api, selectedCompany]);

  const loadUsers = useCallback(async (companyId) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/super-admin/companies/${companyId}/users`);
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadUsers(selectedCompany);
  }, [selectedCompany, loadUsers]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!selectedCompany) return;
    try {
      await api.post(`/super-admin/companies/${selectedCompany}/users`, form);
      setForm({ email: '', name: '', role: 'USER', password: '' });
      loadUsers(selectedCompany);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/super-admin/companies/${selectedCompany}/users/${user.id}`, {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: !user.isActive,
      });
      loadUsers(selectedCompany);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Company Users</h1>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-600">
            Select company
            <select
              className="mt-1 border border-gray-200 rounded px-3 py-2"
              value={selectedCompany}
              onChange={(event) => setSelectedCompany(event.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-100 text-red-700">{error}</div>}

      <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4 bg-white rounded-xl shadow p-6">
        <h2 className="md:col-span-2 text-xl font-semibold text-gray-800">Create tenant user</h2>
        <input
          type="text"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          type="email"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Email"
          required
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
        <select
          className="border border-gray-200 rounded px-3 py-2"
          value={form.role}
          onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
        >
          <option value="USER">User</option>
          <option value="OPERATIONS">Operations</option>
          <option value="TRANSPORTER">Transporter</option>
          <option value="FINANCE_APPROVER">Finance Approver</option>
          <option value="COMPANY_ADMIN">Company Admin</option>
        </select>
        <input
          type="password"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Temporary password"
          required
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
        />
        <div className="md:col-span-2">
          <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">
            Create user
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Users</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">{user.role}</td>
                    <td className="px-4 py-2">{user.isActive ? 'Active' : 'Disabled'}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(user)}
                        className="rounded border border-slate-200 px-3 py-1 text-xs"
                      >
                        {user.isActive ? 'Disable' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminCompanyUsers;
