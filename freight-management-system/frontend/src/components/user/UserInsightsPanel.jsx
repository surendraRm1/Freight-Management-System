import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const statusClasses = {
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REQUESTED: 'bg-amber-50 text-amber-700',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

const UserInsightsPanel = () => {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isUserRole = ['USER', 'COMPANY_ADMIN'].includes(user?.role);

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      if (!isUserRole) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/user/analytics/overview');
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Unable to load shipment insights.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchOverview();
    return () => {
      mounted = false;
    };
  }, [api, isUserRole]);

  if (!isUserRole) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-slate-500">
        Loading your shipment insights…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm text-rose-600 text-sm">{error}</div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">Shipment tracker</p>
          <h3 className="text-lg font-semibold text-slate-900">Latest bookings & vendor quotes</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-xl font-bold text-slate-900">{data.summary.total}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">Delivered</p>
            <p className="text-xl font-bold text-emerald-700">{data.summary.delivered}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-3">
            <p className="text-xs text-indigo-600">In transit</p>
            <p className="text-xl font-bold text-indigo-700">{data.summary.inTransit}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-600">Pending</p>
            <p className="text-xl font-bold text-amber-700">{data.summary.pending}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Recent shipments</p>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-2">
            {data.shipments.map((shipment) => (
              <div key={shipment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {shipment.trackingNumber || `Shipment #${shipment.id}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {shipment.fromLocation} → {shipment.toLocation}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      statusClasses[shipment.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {shipment.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <p>Pickup</p>
                    <p className="font-semibold text-slate-700">{formatDateTime(shipment.pickupTime)}</p>
                  </div>
                  <div>
                    <p>Delivery</p>
                    <p className="font-semibold text-slate-700">{formatDateTime(shipment.deliveryTime)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!data.shipments.length && <p className="text-xs text-slate-500">No shipments yet.</p>}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Issue log</p>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-2 text-sm">
            {data.issueLog.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
                <p className="font-semibold text-amber-900">
                  {issue.trackingNumber || `Shipment #${issue.id}`}
                </p>
                <p className="text-xs text-amber-800">{issue.description}</p>
                <p className="text-[11px] text-amber-600 mt-1">{formatDateTime(issue.updatedAt)}</p>
              </div>
            ))}
            {!data.issueLog.length && <p className="text-xs text-slate-500">No pending issues 🎉</p>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase text-slate-500">Quote comparison</p>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.quoteInsights.entries.map((quote) => (
            <div key={quote.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{quote.route}</p>
                  <p className="text-xs text-slate-500">Requested {new Date(quote.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {quote.status}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {quote.responses.map((response) => (
                  <div
                    key={response.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{response.vendorName}</p>
                      <p className="text-xs text-slate-500">
                        ETA {response.eta ? new Date(response.eta).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {response.price ? `₹${response.price.toFixed(0)}` : 'N/A'}
                      </p>
                      <p className="text-[11px] text-slate-500">{response.status}</p>
                    </div>
                  </div>
                ))}
                {!quote.responses.length && (
                  <p className="text-xs text-slate-500">Waiting for transporter responses.</p>
                )}
              </div>
            </div>
          ))}
          {!data.quoteInsights.entries.length && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              Request quotes to compare transporter offers here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserInsightsPanel;
