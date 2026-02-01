import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CompanyUserManagement } from '../../components/CompanyUserManagement';

const CompanyUsers = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!user || user.role !== 'COMPANY_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Company Users</h1>
      <CompanyUserManagement />
    </div>
  );
};

export default CompanyUsers;
