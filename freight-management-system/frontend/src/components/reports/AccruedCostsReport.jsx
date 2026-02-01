import { useEffect, useState } from 'react';
import { getAuthToken } from '../../utils/storage';

const AccruedCostsReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = getAuthToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/reports/accrued-costs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load accrued costs report');
        }
        const result = await response.json();
        setData(result);
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

  if (loading) return <p className="text-sm text-gray-500">Loading accrued costs...</p>;
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Accrued Costs (Un-invoiced Delivered Shipments)
      </h3>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered On</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 && (
              <tr>
                <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                  No un-invoiced shipments found.
                </td>
              </tr>
            )}
            {data.map((shipment) => (
              <tr key={shipment.id}>
                <td className="px-6 py-4 text-sm text-indigo-600">{shipment.erp_order_id || shipment.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{shipment.customer_name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(shipment.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccruedCostsReport;
