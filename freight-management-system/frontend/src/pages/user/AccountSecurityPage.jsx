import { useEffect, useState, useMemo } from 'react';
import { Shield, Bell, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_PREFERENCES = {
  shipmentAlerts: true,
  complianceAlerts: true,
  digestReports: false,
};

const AccountSecurityPage = () => {
  const { api, user, refreshUser } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefMessage, setPrefMessage] = useState('');

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [allowedIpInput, setAllowedIpInput] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');

  const [consentType, setConsentType] = useState('ai_assistant');
  const [consentStatus, setConsentStatus] = useState('ACCEPTED');
  const [consentMessage, setConsentMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/user/preferences');
        setPreferences((prev) => ({ ...prev, ...(data?.preferences || {}) }));
      } catch (error) {
        console.error('Failed to load preferences', error);
      } finally {
        setLoadingPrefs(false);
      }
    };
    load();
  }, [api]);

  useEffect(() => {
    if (user?.allowedIpRanges) {
      setAllowedIpInput(user.allowedIpRanges.join('\n'));
    }
    if (typeof user?.twoFactorEnabled === 'boolean') {
      setTwoFactorEnabled(user.twoFactorEnabled);
    }
  }, [user]);

  const handlePreferenceToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    setPrefMessage('');
    try {
      await api.put('/user/preferences', { preferences });
      setPrefMessage('Notification preferences updated.');
    } catch (error) {
      setPrefMessage(error.response?.data?.error || 'Failed to update preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const parseAllowedIps = useMemo(
    () => () =>
      allowedIpInput
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    [allowedIpInput]
  );

  const saveSecurity = async () => {
    setSavingSecurity(true);
    setSecurityMessage('');
    try {
      await api.put('/user/security', {
        twoFactorEnabled,
        allowedIpRanges: parseAllowedIps(),
      });
      await refreshUser();
      setSecurityMessage(twoFactorEnabled ? 'Two-factor authentication enabled.' : 'Security settings updated.');
    } catch (error) {
      setSecurityMessage(error.response?.data?.error || 'Failed to update security settings.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const submitConsent = async () => {
    setConsentMessage('');
    try {
      await api.post('/user/consents', {
        consentType,
        status: consentStatus,
      });
      setConsentMessage('Consent updated.');
    } catch (error) {
      setConsentMessage(error.response?.data?.error || 'Failed to record consent.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
          <Bell className="h-6 w-6 text-amber-500" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Notification preferences</p>
            <p className="text-sm text-slate-500">Choose how we keep you informed.</p>
          </div>
        </header>
        {loadingPrefs ? (
          <p className="text-sm text-slate-500">Loading preferences…</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(preferences).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-sm text-slate-500">
                    {key === 'shipmentAlerts'
                      ? 'Heads-up for pickups, delays, and deliveries.'
                      : key === 'complianceAlerts'
                      ? 'Urgent reminders for GST, POD, and KYC tasks.'
                      : 'Weekly summary of lanes, spend, and performance.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={() => handlePreferenceToggle(key)}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={savePreferences}
              disabled={savingPrefs}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingPrefs ? 'Saving…' : 'Save preferences'}
            </button>
            {prefMessage && <p className="text-sm text-slate-600">{prefMessage}</p>}
          </div>
        )}
      </section>

  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
          <Shield className="h-6 w-6 text-blue-500" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Account security</p>
            <p className="text-sm text-slate-500">Protect access with two-factor auth and IP policies.</p>
          </div>
        </header>
        <div className="space-y-6">
          <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Two-factor authentication</p>
              <p className="text-sm text-slate-500">Send a one-time verification code during login.</p>
            </div>
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(event) => setTwoFactorEnabled(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>
          <div>
            <label className="text-sm font-medium text-slate-700">Allowed IP addresses</label>
            <p className="text-xs text-slate-500 mb-2">
              Add one IP per line. Leave empty to allow secure access from anywhere.
            </p>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
              value={allowedIpInput}
              onChange={(event) => setAllowedIpInput(event.target.value)}
              placeholder="203.0.113.5&#10;198.51.100.7"
            />
          </div>
          <button
            type="button"
            onClick={saveSecurity}
            disabled={savingSecurity}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {savingSecurity ? 'Updating…' : 'Update security settings'}
          </button>
          {securityMessage && <p className="text-sm text-slate-600">{securityMessage}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
          <Lock className="h-6 w-6 text-purple-500" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Data & AI consent</p>
            <p className="text-sm text-slate-500">Tell us how we may use your data for automation.</p>
          </div>
        </header>
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-700">Consent type</label>
          <select
            value={consentType}
            onChange={(event) => setConsentType(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 focus:border-purple-500 focus:bg-white focus:outline-none"
          >
            <option value="ai_assistant">AI assistant analysis</option>
            <option value="product_updates">Product updates</option>
            <option value="marketing_insights">Marketing insights</option>
          </select>

          <label className="text-sm font-medium text-slate-700">Preference</label>
          <div className="flex gap-6 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="consentStatus"
                value="ACCEPTED"
                checked={consentStatus === 'ACCEPTED'}
                onChange={(event) => setConsentStatus(event.target.value)}
              />
              Allow
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="consentStatus"
                value="DECLINED"
                checked={consentStatus === 'DECLINED'}
                onChange={(event) => setConsentStatus(event.target.value)}
              />
              Decline
            </label>
          </div>
          <button
            type="button"
            onClick={submitConsent}
            className="inline-flex items-center justify-center rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Save consent
          </button>
          {consentMessage && <p className="text-sm text-slate-600">{consentMessage}</p>}
        </div>
      </section>
    </div>
  );
};

export default AccountSecurityPage;
