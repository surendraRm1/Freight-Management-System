import { useEffect, useState } from 'react';
import { getAuthToken } from '../../utils/storage';

const TransporterScorecard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = getAuthToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/reports/transporter-scorecard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load transporter scorecard');
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
  if (loading) return <p className="text-sm text-gray-500">Loading transporter scorecard...</p>;
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Transporter Performance Scorecard</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Transporter</th>
              <th className="px-4 py-3 text-left">Total Shipments</th>
              <th className="px-4 py-3 text-left">Avg. Cost</th>
              <th className="px-4 py-3 text-left">POD Compliance</th>
              <th className="px-4 py-3 text-left">Invoice Rejection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!data.length && (
              <tr>
                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                  No transporter data available.
                </td>
              </tr>
            )}
            {data.map((transporter) => (
              <tr key={transporter.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{transporter.name}</td>
                <td className="px-4 py-3 text-gray-600">{transporter.totalShipments}</td>
                <td className="px-4 py-3 text-gray-600">₹{transporter.avgCost.toLocaleString('en-IN')}</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    transporter.podCompliance >= 95 ? 'text-green-600' : 'text-amber-600'
                  }`}
                >
                  {transporter.podCompliance}%
                </td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    transporter.invoiceRejectionRate <= 5 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transporter.invoiceRejectionRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransporterScorecard;
