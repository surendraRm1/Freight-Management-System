import { useEffect, useState } from 'react';
import { getAuthToken } from '../../utils/storage';

const PodPerformanceKpi = () => {
  const [kpi, setKpi] = useState({ percentage: 0, totalDelivered: 0, totalCollected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = getAuthToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/reports/pod-performance-kpi', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load POD KPI');
        }
        const result = await response.json();
        setKpi(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  if (!token) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-emerald-600">POD collection rate</p>
      {loading ? (
        <p className="mt-2 text-3xl font-bold text-gray-800">--%</p>
      ) : (
        <p className="mt-2 text-3xl font-bold text-emerald-600">{kpi.percentage}%</p>
      )}
      {error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : (
        <p className="text-xs text-slate-500 mt-1">
          {loading ? 'Calculating...' : `${kpi.totalCollected} / ${kpi.totalDelivered} delivered shipments`}
        </p>
      )}
    </div>
  );
};

export default PodPerformanceKpi;
