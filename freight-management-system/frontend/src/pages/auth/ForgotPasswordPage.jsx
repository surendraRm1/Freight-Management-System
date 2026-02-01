import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import KcoLogo from '../../components/ui/KcoLogo';
import AuthLayout from './AuthLayout';

const ForgotPasswordPage = () => {
  const { api } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.post('/auth/request-password-reset', { email });
      setSuccess(data.message || 'If the account exists, a reset link has been emailed.');
    } catch (err) {
      setError(err.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (success) {
      setSuccess(''); // Clear success message when user starts typing again
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
              <h1 className="text-4xl font-bold text-white">Forgot Password</h1>
              <p className="mt-2 text-slate-400">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            </header>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-lg">
              {error && <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-100" role="alert"><AlertCircle className="h-5 w-5" /><span>{error}</span></div>}
              {success && <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100" role="alert"><CheckCircle2 className="mt-0.5 h-5 w-5" /><span>{success}</span></div>}

              {!success && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={handleEmailChange} required className="w-full rounded-lg border-gray-600 bg-gray-900/50 py-3 pl-12 pr-4 text-white placeholder-gray-400 ring-1 ring-transparent transition focus:border-orange-400 focus:bg-gray-800 focus:outline-none focus:ring-orange-400" placeholder="Email Address" aria-label="Email address" />
                  </div>

                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-lg bg-orange-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:bg-orange-400/50">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Send Reset Link'}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-sm text-slate-400">
                <Link to="/login" className="inline-flex items-center gap-2 font-medium text-orange-400 hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">© 2025 KCO Freight Systems. All Rights Reserved.</p>
          </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;


