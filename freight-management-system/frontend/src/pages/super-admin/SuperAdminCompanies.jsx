import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const defaultForm = {
  name: '',
  billingEmail: '',
  plan: 'standard',
  subscriptionStatus: 'active',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

const SuperAdminCompanies = () => {
  const { user, api, loading } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [rotatedSecrets, setRotatedSecrets] = useState({});

  const loadCompanies = useCallback(async () => {
    try {
      const { data } = await api.get('/super-admin/companies');
      setCompanies(data);
      setRotatedSecrets({});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load companies');
    }
  }, [api]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadCompanies();
    }
  }, [loadCompanies, user]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post('/super-admin/companies', {
        name: form.name,
        billingEmail: form.billingEmail,
        plan: form.plan,
        subscriptionStatus: form.subscriptionStatus,
        admin: {
          name: form.adminName,
          email: form.adminEmail,
          password: form.adminPassword,
        },
      });
      setForm(defaultForm);
      loadCompanies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const rotateSecret = async (companyId) => {
    if (!window.confirm('Rotate webhook secret for this company?')) return;
    try {
      const { data } = await api.post(`/super-admin/companies/${companyId}/rotate-webhook`);
      const last4 = data.webhookSecret.slice(-4);
      setCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId ? { ...company, webhookSecretLast4: last4 } : company,
        ),
      );
      setRotatedSecrets((prev) => ({ ...prev, [companyId]: data.webhookSecret }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to rotate secret');
    }
  };

  const renameCompany = async (company) => {
    const name = window.prompt('Enter new company name', company.name);
    if (!name || name === company.name) return;
    await api.put(`/super-admin/companies/${company.id}`, { name });
    loadCompanies();
  };

  const toggleCompanyStatus = async (company) => {
    const nextStatus = company.status === 'active' ? 'suspended' : 'active';
    await api.put(`/super-admin/companies/${company.id}`, { status: nextStatus });
    loadCompanies();
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Console</h1>
        <p className="text-sm text-gray-500">Provision tenants, manage billing status, and rotate webhook secrets.</p>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <form onSubmit={handleCreate} className="bg-white rounded-xl shadow p-6 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-xl font-semibold text-gray-800">Create Company</h2>
        <input
          type="text"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Company name"
          required
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          type="email"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Billing email"
          value={form.billingEmail}
          onChange={(event) => setForm((prev) => ({ ...prev, billingEmail: event.target.value }))}
        />
        <select
          className="border border-gray-200 rounded px-3 py-2"
          value={form.plan}
          onChange={(event) => setForm((prev) => ({ ...prev, plan: event.target.value }))}
        >
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select
          className="border border-gray-200 rounded px-3 py-2"
          value={form.subscriptionStatus}
          onChange={(event) => setForm((prev) => ({ ...prev, subscriptionStatus: event.target.value }))}
        >
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="suspended">Suspended</option>
        </select>
        <input
          type="text"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Admin name"
          value={form.adminName}
          onChange={(event) => setForm((prev) => ({ ...prev, adminName: event.target.value }))}
        />
        <input
          type="email"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Admin email"
          required
          value={form.adminEmail}
          onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
        />
        <input
          type="password"
          className="border border-gray-200 rounded px-3 py-2"
          placeholder="Admin password"
          required
          value={form.adminPassword}
          onChange={(event) => setForm((prev) => ({ ...prev, adminPassword: event.target.value }))}
        />
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow divide-y">
        {companies.map((company) => (
          <div key={company.id} className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-800">{company.name}</p>
                <p className="text-sm text-gray-500">
                  {company.plan} • {company.subscriptionStatus} • Status: {company.status}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{new Date(company.createdAt).toLocaleDateString()}</p>
                {company.trialEndsAt && <p>Trial ends {new Date(company.trialEndsAt).toLocaleDateString()}</p>}
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                Webhook secret:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded break-all">
                  {company.webhookSecretLast4 ? `****${company.webhookSecretLast4}` : '-'}
                </code>
              </p>
              {rotatedSecrets[company.id] && (
                <p className="text-emerald-700">
                  New secret:{' '}
                  <code className="bg-emerald-50 px-2 py-1 rounded break-all">
                    {rotatedSecrets[company.id]}
                  </code>
                </p>
              )}
              <button
                type="button"
                onClick={() => rotateSecret(company.id)}
                className="ml-3 text-indigo-600 hover:underline"
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={() => renameCompany(company)}
                className="ml-3 text-slate-600 hover:underline"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => toggleCompanyStatus(company)}
                className="ml-3 text-slate-600 hover:underline"
              >
                {company.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
        {!companies.length && (
          <div className="p-4 text-center text-gray-500">No companies onboarded yet.</div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminCompanies;
