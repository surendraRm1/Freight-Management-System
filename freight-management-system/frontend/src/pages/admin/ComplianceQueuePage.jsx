import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ComplianceOverviewPanel from '../../components/compliance/ComplianceOverviewPanel';

const formatStatus = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DOCUMENT_LABELS = {
  GST_INVOICE: 'GST invoice',
  SELF_INVOICE_RCM: 'RCM self-invoice',
  EWAY_BILL: 'E-way bill',
  DRIVER_KYC: 'Driver KYC',
  VEHICLE_KYC: 'Vehicle KYC',
};

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const TYPE_OPTIONS = [
  { label: 'All document types', value: '' },
  { label: 'GST invoice', value: 'GST_INVOICE' },
  { label: 'RCM self-invoice', value: 'SELF_INVOICE_RCM' },
  { label: 'E-way bill', value: 'EWAY_BILL' },
  { label: 'Driver KYC', value: 'DRIVER_KYC' },
  { label: 'Vehicle KYC', value: 'VEHICLE_KYC' },
];

const ComplianceQueuePage = () => {
  const { api } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadQueue = useCallback(async () => {
    try {
      setError('');
      setRefreshing(true);
      const response = await api.get('/compliance/queue', {
        params: {
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        },
      });
      setDocuments(response.data.documents || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load compliance queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, statusFilter, typeFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const metrics = useMemo(() => {
    const total = documents.length;
    const byType = documents.reduce(
      (acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      },
      {},
    );
    const byStatus = documents.reduce(
      (acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      },
      {},
    );
    return { total, byType, byStatus };
  }, [documents]);

  const handleDownload = async (docId) => {
    try {
      const response = await api.get(`/compliance/documents/${docId}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `compliance-${docId}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download compliance document.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Compliance queue</h1>
        <p className="text-sm text-slate-500">
          Monitor pending GST, RCM, e-way bill, and KYC tasks across all shipments.
        </p>
      </div>

      <ComplianceOverviewPanel />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Open items</p>
            <p className="text-2xl font-semibold text-slate-900">{metrics.total}</p>
          </div>
          <button
            type="button"
            onClick={loadQueue}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPE_OPTIONS.slice(1).map((option) => (
            <div key={option.value} className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{option.label}</p>
              <p className="text-lg font-semibold text-slate-900">
                {metrics.byType[option.value] || 0}
              </p>
            </div>
          ))}
          {STATUS_OPTIONS.slice(1).map((option) => (
            <div key={option.value} className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {option.label} items
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {metrics.byStatus[option.value] || 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Document type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Shipment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last update</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
                    Loading compliance queue...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    All caught up! There are no outstanding compliance items.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">
                        {DOCUMENT_LABELS[doc.type] || formatStatus(doc.type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        #{doc.id} • Created {formatDateTime(doc.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/shipments/${doc.shipment.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {doc.shipment.trackingNumber || doc.shipment.id}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {doc.shipment.fromLocation} → {doc.shipment.toLocation}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatStatus(doc.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {formatDateTime(doc.updatedAt || doc.createdAt)}
                      </p>
                      {doc.events?.[0] && (
                        <p className="text-xs text-slate-500">
                          {formatStatus(doc.events[0].eventType)} by system
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/shipments/${doc.shipment.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                        >
                          View shipment
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                        >
                          <Download className="h-4 w-4" />
                          Download JSON
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ComplianceQueuePage;
