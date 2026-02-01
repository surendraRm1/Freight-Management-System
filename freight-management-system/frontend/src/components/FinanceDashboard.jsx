import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const FinanceDashboard = () => {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/invoices/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load invoices');
      }
      const data = await response.json();
      setInvoices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchInvoices();
    }
  }, [token, fetchInvoices]);

  const callAction = async (id, action, payload) => {
    const response = await fetch(`/api/v1/invoices/${id}/${action}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Action failed');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve invoice and post to ERP?')) return;
    try {
      await callAction(id, 'approve');
      fetchInvoices();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (id) => {
    const notes = window.prompt('Enter rejection notes');
    if (!notes) return;
    try {
      await callAction(id, 'reject', { notes });
      fetchInvoices();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p className="text-center text-gray-500">Loading pending invoices...</p>;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Finance Approval Dashboard</h2>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shipment / Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No pending invoices.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-6 py-3 text-sm text-gray-900">
                  {invoice.shipment?.customer_name || invoice.shipment?.id}
                </td>
                <td className="px-6 py-3 text-sm text-indigo-600">
                  <a href={invoice.invoice_url} target="_blank" rel="noreferrer">
                    {invoice.invoice_number}
                  </a>
                </td>
                <td className="px-6 py-3 text-sm text-gray-800">₹{invoice.invoice_amount.toFixed(2)}</td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-sm space-x-3">
                  <button onClick={() => handleApprove(invoice.id)} className="text-green-600 hover:text-green-800">
                    Approve
                  </button>
                  <button onClick={() => handleReject(invoice.id)} className="text-red-600 hover:text-red-800">
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
