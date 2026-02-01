import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const CompanySettings = () => {
  const { user, api, loading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [rotatedSecret, setRotatedSecret] = useState(null);
  const [form, setForm] = useState({
    name: '',
    billingEmail: '',
    plan: 'standard',
    subscriptionStatus: 'active',
    trialEndsAt: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/company');
      setProfile(data);
      setRotatedSecret(null);
      setForm({
        name: data.name || '',
        billingEmail: data.billingEmail || '',
        plan: data.plan || 'standard',
        subscriptionStatus: data.subscriptionStatus || 'active',
        trialEndsAt: data.trialEndsAt ? data.trialEndsAt.substring(0, 10) : '',
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err.response?.data?.error || 'Failed to load company profile' });
    }
  }, [api]);

  useEffect(() => {
    if (user?.role === 'COMPANY_ADMIN') {
      loadProfile();
    }
  }, [user, loadProfile]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/company', {
        name: form.name,
        billingEmail: form.billingEmail,
      });
      await api.put('/company/billing', {
        plan: form.plan,
        subscriptionStatus: form.subscriptionStatus,
        billingEmail: form.billingEmail,
        trialEndsAt: form.trialEndsAt ? new Date(form.trialEndsAt).toISOString() : null,
      });
      setMessage({ tone: 'success', text: 'Company settings updated.' });
      loadProfile();
    } catch (err) {
      setMessage({ tone: 'error', text: err.response?.data?.error || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const rotateSecret = async () => {
    if (!window.confirm('Rotate webhook secret? Existing ERP integrations must update.')) return;
    try {
      const { data } = await api.post('/company/rotate-webhook');
      const last4 = data.webhookSecret.slice(-4);
      setProfile((prev) => ({ ...prev, webhookSecretLast4: last4 }));
      setRotatedSecret(data.webhookSecret);
      setMessage({
        tone: 'success',
        text: 'Webhook secret rotated. Copy the new value below and update your ERP configuration immediately.',
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err.response?.data?.error || 'Failed to rotate webhook secret' });
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!user || user.role !== 'COMPANY_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-500">Manage billing and ERP configuration for your workspace.</p>
      </div>

      {message && (
        <div
          className={`p-3 rounded ${
            message.tone === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 grid md:grid-cols-2 gap-4">
        <label className="text-sm text-gray-600">
          Company name
          <input
            type="text"
            className="mt-1 border border-gray-200 rounded px-3 py-2 w-full"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </label>
        <label className="text-sm text-gray-600">
          Billing email
          <input
            type="email"
            className="mt-1 border border-gray-200 rounded px-3 py-2 w-full"
            value={form.billingEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, billingEmail: event.target.value }))}
          />
        </label>
        <label className="text-sm text-gray-600">
          Plan
          <select
            className="mt-1 border border-gray-200 rounded px-3 py-2 w-full"
            value={form.plan}
            onChange={(event) => setForm((prev) => ({ ...prev, plan: event.target.value }))}
          >
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Subscription status
          <select
            className="mt-1 border border-gray-200 rounded px-3 py-2 w-full"
            value={form.subscriptionStatus}
            onChange={(event) => setForm((prev) => ({ ...prev, subscriptionStatus: event.target.value }))}
          >
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Trial ends on
          <input
            type="date"
            className="mt-1 border border-gray-200 rounded px-3 py-2 w-full"
            value={form.trialEndsAt}
            onChange={(event) => setForm((prev) => ({ ...prev, trialEndsAt: event.target.value }))}
          />
        </label>
        <div className="md:col-span-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {profile && (
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">ERP Webhook</h2>
          <p className="text-sm text-gray-500">
            Webhook secrets are hidden for safety. Rotate to generate a new value and update your ERP immediately.
          </p>
          <p className="text-sm text-gray-600">
            Current secret ending:{' '}
            <span className="font-mono">
              {profile.webhookSecretLast4 ? `****${profile.webhookSecretLast4}` : 'Not generated'}
            </span>
          </p>
          {rotatedSecret && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-700">New secret (copy now):</p>
              <code className="block bg-gray-100 rounded px-3 py-2 text-sm break-all">{rotatedSecret}</code>
            </div>
          )}
          <button type="button" onClick={rotateSecret} className="text-indigo-600 text-sm hover:underline">
            Rotate webhook secret
          </button>
        </div>
      )}
    </div>
  );
};

export default CompanySettings;
