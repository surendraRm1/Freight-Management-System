import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const SuperAdminPlatformUsers = () => {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/super-admin/platform-users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load platform users');
    }
  }, [api]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/super-admin/platform-users', form);
      setForm({ email: '', name: '', password: '' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const toggleActive = async (user) => {
    await api.put(`/super-admin/platform-users/${user.id}`, {
      email: user.email,
      name: user.name,
      isActive: !user.isActive,
    });
    loadUsers();
  };

  const deleteUser = async (user) => {
    if (!window.confirm('Remove this SUPER_ADMIN access?')) return;
    await api.delete(`/super-admin/platform-users/${user.id}`);
    loadUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Staff</h1>
        <p className="text-sm text-gray-500">Create or manage SUPER_ADMIN accounts.</p>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-4 bg-white rounded-xl shadow p-6">
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
        <input
          type="password"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Password"
          required
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
        />
        <div className="md:col-span-3">
          <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">
            Create SUPER_ADMIN
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Existing staff</h2>
        <div className="divide-y divide-slate-100">
          {users.map((user) => (
            <div key={user.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{user.email}</p>
                <p className="text-xs text-gray-500">{user.isActive ? 'Active' : 'Disabled'}</p>
              </div>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => toggleActive(user)}
                  className="rounded border border-slate-200 px-3 py-1 text-xs"
                >
                  {user.isActive ? 'Disable' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteUser(user)}
                  className="rounded border border-red-200 px-3 py-1 text-xs text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="py-4 text-sm text-gray-500">No platform staff yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPlatformUsers;
