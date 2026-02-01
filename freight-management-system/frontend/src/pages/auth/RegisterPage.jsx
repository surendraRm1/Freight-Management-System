import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, Building, Hash, User, Eye, EyeOff, Phone as PhoneIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import KcoLogo from '../../components/ui/KcoLogo';
import AuthLayout from './AuthLayout';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();

  const initialFormState = {
    name: '',
    email: '',
    phone: '', // Already present, which is great!
    role: 'USER',
    password: '',
    confirmPassword: '',
    vendorId: '',
  };

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && form.role === 'AGENT') {
      const fetchVendors = async () => {
        try {
          const { data } = await api.get('/admin/vendors?limit=1000');
          setVendors(data.vendors || []);
        } catch (err) {
          console.error('Failed to fetch vendors', err);
        }
      };
      fetchVendors();
    }
  }, [user, api, form.role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name) newErrors.name = 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address.';
    if (!form.phone) newErrors.phone = 'Phone number is required.';
    if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (form.role === 'AGENT' && !form.vendorId) newErrors.vendorId = 'Vendor ID is required for agents.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword: _confirmPassword, ...payload } = form;
      if (payload.role !== 'AGENT') {
        delete payload.vendorId;
      } else {
        // Ensure vendorId is a number if it's not from the admin dropdown
        if (user?.role !== 'ADMIN') {
          const numVendorId = Number(payload.vendorId);
          if (isNaN(numVendorId) || numVendorId <= 0) {
            setErrors({ vendorId: 'Please enter a valid Vendor ID.' });
            setLoading(false);
            return;
          }
          payload.vendorId = numVendorId;
        }
      }

      const { data } = await api.post('/auth/register', payload);
      setSuccess(data.message || 'Registration successful! You will be redirected shortly.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const apiError = err.response?.data?.error || 'Registration failed. Please try again.';
      setErrors({ form: apiError });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border-gray-600 bg-gray-900/50 py-3 pl-12 pr-4 text-white placeholder-gray-400 ring-1 ring-transparent transition focus:border-orange-400 focus:bg-gray-800 focus:outline-none focus:ring-orange-400";

  return (
    <AuthLayout loading={loading}>
          <div className="w-full max-w-md">
            <header className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-3">
                <KcoLogo className="h-10 w-10" />
                <span className="text-2xl font-semibold text-white">Freight Management System</span>
              </div>
              <h1 className="text-4xl font-bold text-white">Create an Account</h1>
              <p className="mt-2 text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-orange-400 hover:underline">
                  Sign In
                </Link>
              </p>
            </header>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-lg">
              {errors.form && <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-100"><AlertCircle className="h-5 w-5" /><span>{errors.form}</span></div>}
              {success && <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/20 px-4 py-3 text-sm text-green-100"><AlertCircle className="h-5 w-5" /><span>{success}</span></div>}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type="text" name="name" value={form.name} onChange={handleChange} required className={inputClass} placeholder="Full Name" />
                  </div>
                  {errors.name && <p className="text-xs text-red-400 pl-4">{errors.name}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type="email" name="email" value={form.email} onChange={handleChange} required className={inputClass} placeholder="Email Address" />
                  </div>
                  {errors.email && <p className="text-xs text-red-400 pl-4">{errors.email}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <PhoneIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} required className={inputClass} placeholder="Phone Number" />
                  </div>
                  {errors.phone && <p className="text-xs text-red-400 pl-4">{errors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required className={inputClass + " pr-12"} placeholder="Password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400 pl-4">{errors.password}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required className={inputClass + " pr-12"} placeholder="Confirm Password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-red-400 pl-4">{errors.confirmPassword}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <select name="role" value={form.role} onChange={handleChange} required className={`${inputClass} appearance-none`}>
                      <option value="USER">Shipper / User</option>
                      <option value="VENDOR">Vendor / Transporter</option>
                      <option value="AGENT">Agent (for a Vendor)</option>
                    </select>
                  </div>
                </div>

                {form.role === 'AGENT' && (
                  <div className="space-y-1">
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      {user?.role === 'ADMIN' ? (
                         <select name="vendorId" value={form.vendorId} onChange={handleChange} required className={`${inputClass} appearance-none`}>
                           <option value="">Select Vendor</option>
                           {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                         </select>
                      ) : (
                        <input type="number" name="vendorId" value={form.vendorId} onChange={handleChange} required className={inputClass} placeholder="Your assigned Vendor ID" />
                      )}
                    </div>
                    {errors.vendorId && <p className="text-xs text-red-400 pl-4">{errors.vendorId}</p>}
                  </div>
                )}

                <button type="submit" disabled={loading || !!success} className="flex w-full items-center justify-center rounded-lg bg-orange-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:bg-orange-400/50">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Create Account'}
                </button>
              </form>
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">© 2025 KCO Freight Systems. All Rights Reserved.</p>
          </div>
    </AuthLayout>
  );
};

export default RegisterPage;


