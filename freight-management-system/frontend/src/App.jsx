import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import FreightCalculationPage from './pages/auth/FreightCalculationPage';
import VendorSelectionPage from './pages/user/VendorSelectionPage';
import ShipmentDashboard from './pages/user/ShipmentDashboard';
import ShipmentDetails from './pages/user/ShipmentDetails';
import DashboardLayout from './components/layout/DashboardLayout';
import { Loader2 } from 'lucide-react';
import AgreementManagementPage from './pages/admin/AgreementManagementPage';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import VendorManagementPage from './pages/admin/VendorManagementPage';
import ComplianceQueuePage from './pages/admin/ComplianceQueuePage';
import QuoteBoard from './pages/vendor/QuoteBoard';
import TransporterInbox from './pages/transporter/TransporterInbox';
import KycUploadPage from './pages/agent/KycUploadPage';
import DriverDirectoryPage from './pages/transporter/DriverDirectoryPage';
import CompanyUsers from './pages/admin/CompanyUsers';
import CompanySettings from './pages/admin/CompanySettings';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import SuperAdminCompanies from './pages/super-admin/SuperAdminCompanies';
import SuperAdminCompanyUsers from './pages/super-admin/SuperAdminCompanyUsers';
import SuperAdminPlatformUsers from './pages/super-admin/SuperAdminPlatformUsers';
import { FinanceDashboard } from './components/FinanceDashboard';
import AccountSecurityPage from './pages/user/AccountSecurityPage';
import OperationsDashboard from './pages/operations/OperationsDashboard';
import TransporterDashboard from './pages/transporter/TransporterDashboard';

const getLandingRoute = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard';
    case 'COMPANY_ADMIN':
    case 'USER':
      return '/dashboard';
    case 'OPERATIONS':
      return '/operations';
    case 'FINANCE_APPROVER':
      return '/finance';
    case 'TRANSPORTER':
      return '/transporter/inbox';
    default:
      return '/dashboard';
  }
};


// Protected Route Component
const ProtectedRoute = ({ children, requiredRole, requiredPermission, redirectTo = '/login' }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (user?.role === 'SUPER_ADMIN') {
    return children;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user?.role)) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  if (requiredPermission) {
    const permissions = user?.permissions || [];
    if (!permissions.includes(requiredPermission)) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};

// Component to handle root URL redirection
const RootRedirect = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    // Show a loader instead of a blank screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getLandingRoute(user?.role)} replace />;
};

const RouterComponent = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? HashRouter
  : BrowserRouter;

const App = () => {
  return (
    <AuthProvider>
      <SyncProvider>
        <RouterComponent>
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Handle root path */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Routes within Dashboard Layout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole={['COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'TRANSPORTER', 'USER']}>
                  <ShipmentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calculate"
              element={
                <ProtectedRoute requiredPermission="CALCULATE_SHIPMENT" redirectTo="/dashboard">
                  <FreightCalculationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/select-vendor"
              element={
                <ProtectedRoute requiredPermission="CALCULATE_SHIPMENT" redirectTo="/dashboard">
                  <VendorSelectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments/:id"
              element={
                <ProtectedRoute requiredRole={['COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'TRANSPORTER', 'USER']}>
                  <ShipmentDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agreements"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <AgreementManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/vendors"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <VendorManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/compliance"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <ComplianceQueuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute requiredRole={['COMPANY_ADMIN', 'FINANCE_APPROVER']}>
                  <AnalyticsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/users"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <CompanyUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/settings"
              element={
                <ProtectedRoute requiredRole="COMPANY_ADMIN">
                  <CompanySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute requiredRole={['COMPANY_ADMIN', 'FINANCE_APPROVER']}>
                  <FinanceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operations"
              element={
                <ProtectedRoute requiredRole={['COMPANY_ADMIN', 'OPERATIONS']}>
                  <OperationsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/kyc"
              element={
                <ProtectedRoute requiredRole={['OPERATIONS', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                  <KycUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account/security"
              element={
                <ProtectedRoute>
                  <AccountSecurityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotes"
              element={
                <ProtectedRoute requiredRole={['USER', 'COMPANY_ADMIN', 'SUPER_ADMIN']} redirectTo="/dashboard">
                  <QuoteBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transporter/inbox"
              element={
                <ProtectedRoute
                  requiredRole={['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}
                  redirectTo="/dashboard"
                >
                  <TransporterInbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transporter/dashboard"
              element={
                <ProtectedRoute
                  requiredRole={['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}
                  redirectTo="/dashboard"
                >
                  <TransporterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transporter/drivers"
              element={
                <ProtectedRoute
                  requiredRole={['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}
                  redirectTo="/dashboard"
                >
                  <DriverDirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/dashboard"
              element={
                <ProtectedRoute requiredRole="SUPER_ADMIN">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/companies"
              element={
                <ProtectedRoute requiredRole="SUPER_ADMIN">
                  <SuperAdminCompanies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/company-users"
              element={
                <ProtectedRoute requiredRole="SUPER_ADMIN">
                  <SuperAdminCompanyUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/platform-users"
              element={
                <ProtectedRoute requiredRole="SUPER_ADMIN">
                  <SuperAdminPlatformUsers />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </RouterComponent>
      </SyncProvider>
    </AuthProvider>
  );
};

export default App;
