import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const typeLabels = {
  GST_INVOICE: 'GST invoice',
  SELF_INVOICE_RCM: 'RCM self-invoice',
  EWAY_BILL: 'E-way bill',
  DRIVER_KYC: 'Driver KYC',
  VEHICLE_KYC: 'Vehicle KYC',
  LORRY_RECEIPT: 'Lorry receipt',
};

const ComplianceOverviewPanel = () => {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      try {
        const response = await api.get('/compliance/analytics/overview');
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Unable to load compliance overview.');
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
  }, [api]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading compliance analytics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-4 text-sm text-rose-600 shadow-sm">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Compliance dashboard</p>
          <h2 className="text-xl font-semibold text-slate-900">Document health & audit log</h2>
        </div>
        <p className="text-xs text-slate-500">Refreshed {new Date(data.generatedAt).toLocaleString()}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase text-slate-500">Document vault</p>
          <div className="mt-3 space-y-3 max-h-56 overflow-y-auto pr-2 text-sm">
            {data.documentVault.map((entry) => (
              <div key={entry.type} className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="font-semibold text-slate-900">{typeLabels[entry.type] || entry.type}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  {Object.entries(entry.statuses).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span className="font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!data.documentVault.length && <p className="text-xs text-slate-500">No documents recorded yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase text-slate-500">Recent documents</p>
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-2 text-sm">
            {data.recentDocuments.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="font-semibold text-slate-900">
                  {typeLabels[doc.type] || doc.type} · {doc.status}
                </p>
                <p className="text-xs text-slate-500">Shipment {doc.shipment?.trackingNumber || doc.id}</p>
                <p className="text-[11px] text-slate-400">Updated {new Date(doc.updatedAt).toLocaleString()}</p>
              </div>
            ))}
            {!data.recentDocuments.length && <p className="text-xs text-slate-500">No documents uploaded yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase text-slate-500">Upcoming deadlines</p>
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-2 text-sm">
            {data.deadlines.map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-100 bg-white p-3">
                <p className="font-semibold text-slate-900">{item.trackingNumber || `Shipment #${item.id}`}</p>
                <p className="text-xs text-slate-500">
                  {item.fromLocation} → {item.toLocation}
                </p>
                <p className="text-[11px] text-amber-600">
                  Compliance status {item.complianceStatus || 'PENDING'}
                </p>
                <p className="text-[11px] text-amber-600">
                  Pickup {item.pickupTime ? new Date(item.pickupTime).toLocaleDateString() : 'TBD'}
                </p>
              </div>
            ))}
            {!data.deadlines.length && <p className="text-xs text-slate-500">No pending compliance deadlines.</p>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase text-slate-500">Audit trail</p>
        <div className="mt-3 max-h-48 overflow-y-auto pr-2">
          {data.events.map((event) => (
            <div key={event.id} className="border-l-2 border-slate-200 pl-4 pb-3 text-sm">
              <p className="font-semibold text-slate-900">{event.eventType}</p>
              <p className="text-xs text-slate-500">
                {typeLabels[event.document?.type] || event.document?.type} ·{' '}
                {event.document?.shipment?.trackingNumber || 'Shipment'}
              </p>
              <p className="text-[11px] text-slate-400">{new Date(event.recordedAt).toLocaleString()}</p>
            </div>
          ))}
          {!data.events.length && <p className="text-xs text-slate-500">No audit events recorded.</p>}
        </div>
      </div>
    </section>
  );
};

export default ComplianceOverviewPanel;
