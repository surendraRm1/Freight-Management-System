import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import KcoLogo from '../../components/ui/KcoLogo';
import AuthLayout from './AuthLayout';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const { api } = useAuth();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!token) {
      newErrors.form = 'Invalid or missing reset token. Please request a new link.';
    }
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess('');

    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      setSuccess(data.message);
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Failed to reset password. The link may have expired.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout loading={loading}>
          <div className="w-full max-w-md">
            <header className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-3">
                <KcoLogo className="h-10 w-10" />
                <span className="text-2xl font-semibold text-white">Freight Management System</span>
              </div>
              <h1 className="text-4xl font-bold text-white">Reset Your Password</h1>
              <p className="mt-2 text-slate-400">
                Choose a new, strong password for your account.
              </p>
            </header>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-lg">
              {errors.form && <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-100"><AlertCircle className="h-5 w-5" /><span>{errors.form}</span></div>}
              {success && (
                <div className="mb-6 flex flex-col items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-center text-sm text-emerald-100">
                  <CheckCircle2 className="h-6 w-6" />
                  <p className="font-semibold">{success}</p>
                  <Link to="/login" className="mt-2 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900">
                    Proceed to Login
                  </Link>
                </div>
              )}

              {!success && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border-gray-600 bg-gray-900/50 py-3 pl-12 pr-12 text-white placeholder-gray-400 ring-1 ring-transparent transition focus:border-orange-400 focus:bg-gray-800 focus:outline-none focus:ring-orange-400" placeholder="New Password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-400 pl-4">{errors.password}</p>}
                  </div>
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full rounded-lg border-gray-600 bg-gray-900/50 py-3 pl-12 pr-12 text-white placeholder-gray-400 ring-1 ring-transparent transition focus:border-orange-400 focus:bg-gray-800 focus:outline-none focus:ring-orange-400" placeholder="Confirm New Password" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-400 pl-4">{errors.confirmPassword}</p>}
                  </div>
                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-lg bg-orange-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:bg-orange-400/50">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Reset Password'}
                  </button>
                </form>
              )}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">© 2025 KCO Freight Systems. All Rights Reserved.</p>
          </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;

