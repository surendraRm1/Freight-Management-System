import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const CompanyUserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'USER', name: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create user');
      }
      setForm({ email: '', password: '', role: 'USER', name: '' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
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
        <div className="md:col-span-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">
            Create User
          </button>
        </div>
      </form>

      <div>
        {loading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {users.map((user) => (
              <li key={user.id} className="py-3 flex justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                  <p className="text-xs text-gray-500">{user.name || 'N/A'}</p>
                </div>
                <span className="text-xs font-bold text-indigo-600">{user.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
