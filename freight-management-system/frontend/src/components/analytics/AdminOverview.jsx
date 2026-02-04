import { useEffect, useMemo, useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const formatNumber = (value) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0);

const AdminOverview = () => {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const hasCompanyContext = Boolean(user?.companyId) && user?.role === 'COMPANY_ADMIN';
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (!hasCompanyContext) {
      setLoading(false);
      return undefined;
    }

    const fetchOverview = async () => {
      try {
        const response = await api.get('/admin/analytics/overview?range=30');
        if (isMounted) {
          setData(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to load analytics overview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, [api, hasCompanyContext]);

  useEffect(() => {
    let mounted = true;
    const fetchAlerts = async () => {
      if (!hasCompanyContext) return;
      try {
        const response = await api.get('/admin/analytics/alerts');
        if (mounted) {
          setAlerts(response.data?.alerts || []);
        }
      } catch {
        // ignore alert fetch errors
      }
    };
    fetchAlerts();
    return () => {
      mounted = false;
    };
  }, [api, hasCompanyContext]);

  const shipmentsTrend = useMemo(() => {
    if (!data?.charts?.shipmentsByDay) return [];
    return data.charts.shipmentsByDay.slice(-7);
  }, [data]);

  const trendMax = shipmentsTrend.reduce((max, point) => Math.max(max, point.count), 0);

  const handleExport = async (dataset) => {
    setExporting(dataset);
    try {
      const response = await api.get(`/admin/analytics/export/${dataset}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset}-report.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to export ${dataset} dataset.`);
    } finally {
      setExporting('');
    }
  };

  if (!hasCompanyContext) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-500">Loading overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, charts, generatedAt, insights = {} } = data;
  const { vendorScorecards = [], userGovernance = [], revenueSeries = [] } = insights;
  const revenueMax = revenueSeries.reduce((max, point) => Math.max(max, point.value || 0), 0);


  const summaryCards = [
    {
      title: 'Total shipments',
      primary: formatNumber(summary.shipments.total),
      meta: `${formatNumber(summary.shipments.inTransit)} in transit • ${formatNumber(
        summary.shipments.delivered,
      )} delivered`,
    },
    {
      title: 'Quote funnel',
      primary: formatNumber(summary.quotes.requested),
      meta: `${formatNumber(summary.quotes.responded)} responded • ${formatNumber(
        summary.quotes.approved,
      )} approved`,
    },
    {
      title: 'Invoices',
      primary: formatNumber(summary.invoices.total),
      meta: `${formatNumber(summary.invoices.paid)} paid • ${formatNumber(
        summary.invoices.issued + summary.invoices.draft,
      )} pending`,
    },
    {
      title: 'Vendors',
      primary: formatNumber(summary.vendors.total),
      meta: `${formatNumber(summary.vendors.active)} active carriers`,
    },
  ];

  const exportOptions = [
    { id: 'shipments', label: 'Shipments CSV' },
    { id: 'quotes', label: 'Quotes CSV' },
    { id: 'invoices', label: 'Invoices CSV' },
    { id: 'vendors', label: 'Vendors CSV' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-500 font-semibold">
            Company overview
          </p>
          <h2 className="text-2xl font-bold text-slate-900">Last 30 days snapshot</h2>
          <p className="text-xs text-slate-500 mt-1">
            Refreshed {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleExport(option.id)}
              disabled={exporting === option.id}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exporting === option.id ? 'Preparing…' : option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.primary}</p>
            <p className="mt-1 text-xs text-slate-500">{card.meta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Shipments (last 7 days)</p>
          <ul className="mt-4 space-y-2">
            {shipmentsTrend.map((item) => (
              <li key={item.date} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="w-20 text-xs font-medium text-slate-500">{item.date}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{
                      width: trendMax ? `${(item.count / trendMax) * 100}%` : '4px',
                    }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-slate-700">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Quote funnel</p>
          <div className="mt-4 space-y-4">
            {Object.entries(charts.quoteFunnel).map(([stage, value]) => (
              <div key={stage} className="flex items-center justify-between">
                <div className="text-sm capitalize text-slate-600">{stage}</div>
                <div className="flex items-center gap-3">
                  <div className="w-40 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: summary.quotes.requested
                          ? `${(value / summary.quotes.requested) * 100}%`
                          : '4px',
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatNumber(value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!!revenueSeries.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Revenue trend (6 months)</p>
          <div className="mt-4 space-y-3">
            {revenueSeries.map((point) => (
              <div key={point.label} className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium text-slate-500">{point.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{
                      width: revenueMax ? `${((point.value || 0) / revenueMax) * 100}%` : '4px',
                    }}
                  />
                </div>
                <span className="w-20 text-right text-sm font-semibold text-slate-700">
                  ₹{formatNumber(point.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!vendorScorecards.length && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Vendor scorecards</p>
              <p className="text-xs text-slate-500">Top carriers by shipment volume</p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Showing {vendorScorecards.length} vendors
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {vendorScorecards.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{vendor.name}</p>
                    <p className="text-xs text-slate-500">{vendor.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="uppercase tracking-wide">Shipments</dt>
                    <dd className="text-lg font-semibold text-slate-900">{formatNumber(vendor.totalShipments)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide">Delivery rate</dt>
                    <dd className="text-lg font-semibold text-slate-900">{vendor.deliveryRate}%</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide">Avg. cost</dt>
                    <dd className="text-lg font-semibold text-slate-900">₹{formatNumber(vendor.avgCost)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide">Rating</dt>
                    <dd className="text-lg font-semibold text-slate-900">
                      {vendor.rating ? vendor.rating.toFixed(1) : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!userGovernance.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">User governance</p>
          <p className="text-xs text-slate-500 mb-4">Roster status by role</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Active</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                  <th className="px-3 py-2 text-right">Suspended</th>
                  <th className="px-3 py-2 text-right">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {userGovernance.map((row) => (
                  <tr key={row.role}>
                    <td className="px-3 py-2 font-semibold">{row.role}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.total)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{formatNumber(row.active)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{formatNumber(row.pending)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{formatNumber(row.suspended)}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">
                      {row.latestLogin ? new Date(row.latestLogin).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!!alerts.length && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">Predictive alerts</p>
          </div>
          <div className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <div
                key={`${alert.type}-${alert.meta?.shipmentId || alert.meta?.quoteId || alert.meta?.documentId || Math.random()}`}
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-slate-900">{alert.title}</p>
                <p className="text-xs text-slate-600">{alert.details}</p>
                <p className="text-[11px] text-slate-400">{alert.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
