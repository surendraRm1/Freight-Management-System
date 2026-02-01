import { useEffect, useState } from 'react';
import { getAuthToken } from '../../utils/storage';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const RejectedInvoiceAnalysis = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = getAuthToken();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/reports/rejected-invoice-analysis', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch rejection analysis');
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
  if (loading) return <p className="text-sm text-gray-500">Loading rejection analysis...</p>;
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;

  if (!data.length) {
    return <p className="text-sm text-gray-500">No rejected invoices found.</p>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Rejected Invoice Analysis</h3>
      <div className="h-72 w-full bg-white p-4 rounded-lg shadow">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={100} label>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RejectedInvoiceAnalysis;
