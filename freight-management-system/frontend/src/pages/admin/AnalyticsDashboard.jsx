import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AnalyticsDashboard as AnalyticsDashboardComponent } from '../../components/AnalyticsDashboard';

const AnalyticsDashboard = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!user || !['COMPANY_ADMIN', 'FINANCE_APPROVER'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
      <AnalyticsDashboardComponent />
    </div>
  );
};

export default AnalyticsDashboard;
