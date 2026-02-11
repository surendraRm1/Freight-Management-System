import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useSyncMutation from '../hooks/useSyncMutation';

export const CompanyUserManagement = () => {
  const { api } = useAuth();
  const runSyncMutation = useSyncMutation();
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'USER', name: '', vendorId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/users');
      const nextUsers = Array.isArray(data) ? data : data?.users || [];
      setUsers(nextUsers);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchVendors = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/vendors');
      const vendorList = Array.isArray(data)
        ? data
        : Array.isArray(data?.vendors)
          ? data.vendors
          : [];
      setVendors(vendorList);
    } catch (err) {
      console.warn('Failed to load vendors', err);
    }
  }, [api]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...form };
      if (payload.role !== 'TRANSPORTER') {
        delete payload.vendorId;
      } else if (!payload.vendorId) {
        throw new Error('Select a vendor for transporter users.');
      }

      const { queued } = await runSyncMutation({
        request: (client) => client.post('/admin/users', payload),
        queue: {
          entityType: 'COMPANY_USER',
          action: 'CREATE_COMPANY_USER',
          payload,
        },
      });
      setForm({ email: '', password: '', role: 'USER', name: '', vendorId: '' });
      if (!queued) {
        fetchUsers();
      } else {
        setError('Offline: user creation queued and will sync automatically.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">Company Users</h2>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <form className="grid md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
        <input
          type="text"
          className="border border-gray-300 rounded px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          type="email"
          className="border border-gray-300 rounded px-3 py-2"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        />
        <input
          type="password"
          className="border border-gray-300 rounded px-3 py-2"
          placeholder="Password"
          required
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        />
        <select
          className="border border-gray-300 rounded px-3 py-2"
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
        >
          <option value="USER">User</option>
          <option value="OPERATIONS">Operations</option>
          <option value="TRANSPORTER">Transporter</option>
          <option value="FINANCE_APPROVER">Finance Approver</option>
        </select>
        {form.role === 'TRANSPORTER' && (
          <select
            className="border border-gray-300 rounded px-3 py-2"
            value={form.vendorId}
            required
            onChange={(e) => setForm((prev) => ({ ...prev, vendorId: e.target.value }))}
          >
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        )}
        <div className="md:col-span-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">
            Create User
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.role}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.vendor?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
