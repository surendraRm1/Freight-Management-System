import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const ShipmentList = () => {
  const { user, token } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canUploadPod = ['OPERATIONS'].includes(user?.role);
  const canUploadInvoice = ['OPERATIONS', 'TRANSPORTER'].includes(user?.role);

  useEffect(() => {
    const fetchShipments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/v1/shipments', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load shipments');
        }
        const data = await response.json();
        setShipments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchShipments();
    }
  }, [token]);

  const handleUploadPod = async (shipmentId) => {
    const podUrl = window.prompt('Enter POD URL');
    if (!podUrl) return;
    try {
      const response = await fetch(`/api/v1/shipments/${shipmentId}/pod`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pod_url: podUrl }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload POD');
      }
      setShipments((prev) =>
        prev.map((shipment) => (shipment.id === shipmentId ? { ...shipment, pod_status: 'Collected' } : shipment)),
      );
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUploadInvoice = (shipmentId) => {
    window.location.href = `/shipments/${shipmentId}/invoice`;
  };

  const downloadCsv = () => {
    if (!shipments.length) {
      alert('No shipments available to download yet.');
      return;
    }

    const headers = [
      'Shipment ID',
      'Customer',
      'Source',
      'ERP Order',
      'Status',
      'POD Status',
      'Created At',
    ];

    const rows = shipments.map((shipment) => [
      shipment.id,
      shipment.customer_name,
      shipment.source,
      shipment.erp_order_id || '',
      shipment.status,
      shipment.pod_status,
      new Date(shipment.createdAt).toLocaleString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-center text-gray-500">Loading shipments...</p>;
  if (error) return <p className="text-center text-red-500">Error: {error}</p>;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-800">Shipments</h2>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Download CSV
        </button>
      </div>
      <ul className="space-y-3">
        {shipments.map((shipment) => (
          <li key={shipment.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-indigo-600">{shipment.customer_name}</p>
              <p className="text-sm text-gray-500">
                Source:{' '}
                {shipment.source === 'erp' ? (
                  <span className="text-green-600 font-medium">ERP ({shipment.erp_order_id || 'N/A'})</span>
                ) : (
                  <span className="text-blue-600 font-medium">Manual</span>
                )}
              </p>
              <p className="text-xs text-gray-500">POD Status: {shipment.pod_status}</p>
              <p className="text-xs text-gray-500">
                Invoices:{' '}
                <span className="font-semibold text-gray-800">{shipment?._count?.invoices ?? shipment.invoices?.length ?? 0}</span>
              </p>
            </div>
            <div className="space-x-3">
              {canUploadPod && (
                <button
                  type="button"
                  onClick={() => handleUploadPod(shipment.id)}
                  className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                >
                  Upload POD
                </button>
              )}
              {canUploadInvoice && (
                <button
                  type="button"
                  onClick={() => handleUploadInvoice(shipment.id)}
                  className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                >
                  Upload Invoice
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
