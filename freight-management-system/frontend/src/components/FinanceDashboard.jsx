import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatAmount = (value) => currencyFormatter.format(value || 0);

const statusColors = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-rose-50 text-rose-700',
  'Pending RCM': 'bg-indigo-50 text-indigo-700',
};

export const FinanceDashboard = () => {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const hasAccess = ['COMPANY_ADMIN', 'FINANCE_APPROVER'].includes(user?.role);

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      if (!hasAccess) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/finance/overview');
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load finance analytics.');
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
  }, [api, hasAccess]);

  const handleExport = async (dataset) => {
    setExporting(dataset);
    try {
      const response = await api.get(`/finance/export/${dataset}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export dataset.');
    } finally {
      setExporting('');
    }
  };

  const costVarianceTop = useMemo(() => {
    if (!data?.costVariance) return [];
    return data.costVariance
      .filter((entry) => entry.variance !== null)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5);
  }, [data]);

  if (!hasAccess) {
    return <p className="p-6 text-sm text-slate-500">Finance dashboard is restricted to finance roles.</p>;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-500">Loading finance analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
        <p className="text-rose-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-500 font-semibold">Finance workspace</p>
          <h2 className="text-2xl font-bold text-slate-900">Invoice lifecycle & payouts</h2>
          <p className="text-xs text-slate-500">Updated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            onClick={() => handleExport('invoice-ledger')}
            disabled={exporting === 'invoice-ledger'}
          >
            <Download className="h-4 w-4" />
            {exporting === 'invoice-ledger' ? 'Preparing…' : 'Invoice ledger CSV'}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            onClick={() => handleExport('transporter-payouts')}
            disabled={exporting === 'transporter-payouts'}
          >
            <Download className="h-4 w-4" />
            {exporting === 'transporter-payouts' ? 'Preparing…' : 'Transporter payouts CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Invoices</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.counts.invoices}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.invoiceStats.DRAFT || 0} draft • {data.invoiceStats.ISSUED || 0} issued •{' '}
            {data.invoiceStats.PAID || 0} paid
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Transporter invoices</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.counts.transporterInvoices}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.payoutStatus.Pending || 0} pending • {data.payoutStatus.Approved || 0} approved •{' '}
            {data.payoutStatus.Rejected || 0} rejected
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Compliance alerts</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{data.taxSummary.rejectedDocs || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Rejected / missing documents</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending authorizations</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            {data.taxSummary.pendingAuthorizations || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">RCM / payouts awaiting approval</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Invoice lifecycle</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.invoiceKanban.map((column) => (
              <div key={column.status} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">{column.label}</span>
                  <span className="text-xs font-bold text-slate-600">{column.count}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {column.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-lg bg-white p-3 shadow-sm">
                      <p className="text-sm font-semibold text-slate-800">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-slate-500">{invoice.vendor}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{formatAmount(invoice.amount)}</p>
                      {invoice.dueDate && (
                        <p className="text-xs text-slate-500">
                          Due {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                  {!column.invoices.length && (
                    <p className="text-xs text-slate-500">No items in this stage.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Transporter payouts</p>
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Invoice #</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Shipment</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payoutRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.invoiceNumber}</td>
                    <td className="px-3 py-2 text-slate-600">{row.vendorName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.shipmentRef || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          statusColors[row.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data.payoutRows.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      No transporter invoices available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Cost vs contracted rate</p>
          <ul className="mt-4 space-y-3">
            {costVarianceTop.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Shipment #{entry.id}</span>
                  <span
                    className={`text-sm font-bold ${
                      entry.variance > 0 ? 'text-rose-600' : entry.variance < 0 ? 'text-emerald-600' : 'text-slate-600'
                    }`}
                  >
                    {entry.variance > 0 ? '+' : ''}
                    {formatAmount(entry.variance || 0)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>
                    <p className="uppercase tracking-wide">Contracted</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {entry.contracted ? formatAmount(entry.contracted) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide">Actual</p>
                    <p className="text-sm font-semibold text-slate-800">{formatAmount(entry.actual)}</p>
                  </div>
                </div>
              </li>
            ))}
            {!costVarianceTop.length && (
              <li className="text-sm text-slate-500">Not enough shipments to compute variance.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Tax & compliance</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">GST invoices issued</span>
              <span className="text-lg font-semibold text-slate-900">
                {data.taxSummary.issuedGstInvoices || 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Pending authorizations</span>
              <span className="text-lg font-semibold text-slate-900">
                {data.taxSummary.pendingAuthorizations || 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Rejected documents</span>
              <span className="text-lg font-semibold text-rose-600">
                {data.taxSummary.rejectedDocs || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
