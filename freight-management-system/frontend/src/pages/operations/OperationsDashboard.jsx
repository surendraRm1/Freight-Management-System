import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const formatCount = (value) => new Intl.NumberFormat('en-IN').format(value || 0);

const SectionCard = ({ title, children, subtitle }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const OperationsDashboard = () => {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hasAccess = ['COMPANY_ADMIN', 'OPERATIONS'].includes(user?.role);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!hasAccess) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/operations/overview');
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load operations analytics.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [api, hasAccess]);

  if (!hasAccess) {
    return <p className="text-slate-500 text-sm">Operations dashboard is restricted to operations roles.</p>;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
        Loading operations overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm text-rose-600 font-medium">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { board, exceptions, driverReadiness, quoteSla } = data;

  const boardColumns = [
    { key: 'pending', color: 'bg-slate-50', title: 'Pending dispatch' },
    { key: 'active', color: 'bg-indigo-50', title: 'In motion' },
    { key: 'delivered', color: 'bg-emerald-50', title: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-blue-500 font-semibold">Operations control</p>
        <h1 className="text-2xl font-bold text-slate-900">Live execution dashboard</h1>
        <p className="text-xs text-slate-500">Refreshed {new Date(data.generatedAt).toLocaleString()}</p>
      </div>

      <SectionCard title="Execution board" subtitle="Snapshot of current shipments">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {boardColumns.map((column) => (
            <div key={column.key} className={`rounded-xl p-3 ${column.color}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">{column.title}</p>
              <div className="mt-3 space-y-2">
                {board[column.key]?.map((shipment) => (
                  <div key={shipment.id} className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-800">
                      {shipment.trackingNumber || `Shipment #${shipment.id}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {shipment.fromLocation} → {shipment.toLocation}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(shipment.createdAt || shipment.updatedAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                ))}
                {!board[column.key]?.length && <p className="text-xs text-slate-500">No shipments in this column.</p>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Exception log" subtitle="Shipments requiring attention">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {exceptions.map((shipment) => (
              <div key={shipment.id} className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-800">
                    {shipment.trackingNumber || `Shipment #${shipment.id}`}
                  </span>
                  <span className="text-xs text-amber-600">
                    {shipment.complianceStatus !== 'APPROVED' ? 'Compliance pending' : 'ETA lapsed'}
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {shipment.fromLocation} → {shipment.toLocation}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  ETA {shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleString() : 'N/A'}
                </p>
              </div>
            ))}
            {!exceptions.length && <p className="text-xs text-slate-500">No open exceptions 🎉</p>}
          </div>
        </SectionCard>

        <SectionCard title="Driver readiness" subtitle="Transporter contact health">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-900">{formatCount(driverReadiness.summary.total)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs uppercase text-emerald-600">Active</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCount(driverReadiness.summary.active)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-xs uppercase text-rose-600">Inactive</p>
              <p className="text-2xl font-bold text-rose-700">{formatCount(driverReadiness.summary.inactive)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Flagged drivers</p>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {driverReadiness.flaggedDrivers.map((driver) => (
                <div key={driver.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                  <p className="font-semibold text-slate-800">
                    {driver.name} <span className="text-slate-500">({driver.vendor})</span>
                  </p>
                  <p className="text-slate-500">Phone: {driver.phone || 'N/A'}</p>
                </div>
              ))}
              {!driverReadiness.flaggedDrivers.length && <p className="text-xs text-slate-500">All drivers healthy.</p>}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Quote turnaround" subtitle="Last 7 days">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xs uppercase text-slate-500">Responses collected</p>
            <p className="text-3xl font-bold text-slate-900">{formatCount(quoteSla.responsesCollected)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-xs uppercase text-emerald-600">Avg response time</p>
            <p className="text-3xl font-bold text-emerald-700">{quoteSla.averageResponseHours}h</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <p className="text-xs uppercase text-amber-600">Pending quotes</p>
            <p className="text-3xl font-bold text-amber-700">{formatCount(quoteSla.pendingQuotes)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default OperationsDashboard;
