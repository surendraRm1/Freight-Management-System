import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import KcoLogo from '../../components/ui/KcoLogo';
import AuthLayout from './AuthLayout';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorContext, setTwoFactorContext] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (twoFactorContext && twoFactorCode.length < 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(email, password, twoFactorContext ? { twoFactorCode, challengeId: twoFactorContext.challengeId } : {});

    setLoading(false);
    if (result.twoFactorRequired) {
      setTwoFactorContext({
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
      });
      setTwoFactorCode('');
      setInfo(result.message || 'Enter the verification code we emailed to you.');
      return;
    }

    if (result.success) {
      navigate(result.redirectPath || '/dashboard');
    } else {
      setTwoFactorContext(null);
      setTwoFactorCode('');
      setInfo('');
      setError(result.error || 'Invalid credentials. Please try again.');
    }
  };

  const handleResendCode = async () => {
    if (!email || !password) {
      setError('Enter your email and password first.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (result.twoFactorRequired) {
      setTwoFactorContext({
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
      });
      setTwoFactorCode('');
      setInfo('We\'ve sent a fresh verification code to your inbox.');
    } else if (result.success) {
      navigate(result.redirectPath || '/dashboard');
    } else {
      setTwoFactorContext(null);
      setTwoFactorCode('');
      setInfo('');
      setError(result.error || 'Unable to resend code.');
    }
  };

  useEffect(() => {
    if (twoFactorContext) {
      setTwoFactorContext(null);
      setTwoFactorCode('');
      setInfo('');
    }
  }, [email, password]);

  return (
    <AuthLayout loading={loading}>
      <div className="rounded-3xl border border-white/12 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <KcoLogo className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-white/75">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-emerald-200 hover:text-emerald-100">
              Create one
            </Link>
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}
        {twoFactorContext && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <p className="font-semibold">Verification required</p>
              <p className="text-emerald-50">{info || 'Enter the code we emailed to you.'}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/12 py-3 pl-12 pr-4 text-white placeholder-white/40 transition focus:border-emerald-300/70 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
              placeholder="Email address"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/12 py-3 pl-12 pr-12 text-white placeholder-white/40 transition focus:border-emerald-300/70 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 transition hover:text-white"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {!twoFactorContext && (
            <div className="flex items-center justify-between text-xs text-white/70 sm:text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-white/30 bg-transparent text-emerald-300 focus:ring-emerald-400"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="font-medium text-emerald-200 hover:text-emerald-100">
                Forgot password?
              </Link>
            </div>
          )}

          {twoFactorContext && (
            <div className="space-y-2">
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full rounded-xl border border-white/15 bg-white/12 py-3 pl-12 pr-4 text-white placeholder-white/40 transition focus:border-emerald-300/70 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                  placeholder="Enter 6-digit code"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Didn&apos;t get the code?</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="font-semibold text-emerald-200 hover:text-emerald-100"
                  disabled={loading}
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-400/90 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/50 disabled:cursor-not-allowed disabled:bg-emerald-400/40"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-xs text-white/60 sm:text-sm">© 2025 KCO Freight Systems. All rights reserved.</p>
    </AuthLayout>
  );
};

export default LoginPage;
