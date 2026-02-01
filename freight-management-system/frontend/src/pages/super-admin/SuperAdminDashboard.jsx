import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    {helper && <p className="text-xs text-slate-400">{helper}</p>}
  </div>
);

const SuperAdminDashboard = () => {
  const { api } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/super-admin/overview');
        setOverview(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [api]);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading overview...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-sm text-gray-500">Monitor tenant adoption and overall activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total companies" value={overview.companyCount} />
        <StatCard label="Active companies" value={overview.activeCompanies} />
        <StatCard label="Tenant users" value={overview.userCount} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Recently onboarded</h2>
        <p className="text-sm text-gray-500 mb-4">Latest tenants and their status.</p>
        <div className="divide-y divide-slate-100">
          {overview.recentCompanies.length === 0 && (
            <p className="py-4 text-sm text-gray-500">No companies onboarded yet.</p>
          )}
          {overview.recentCompanies.map((company) => (
            <div key={company.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(company.createdAt).toLocaleDateString()} • Status: {company.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
