import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Edit, Trash2, Save, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useDebounce } from '../../hooks/useDebounce';
import MessageBox from '../../components/ui/MessageBox';

const VendorManagementPage = () => {
  const { api } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editVendor, setEditVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms delay
  const [filterStatus, setFilterStatus] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    const loadVendors = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: pagination.page,
          limit: pagination.pageSize,
          search: debouncedSearchTerm,
          status: filterStatus,
        });
        const { data } = await api.get(`/admin/vendors?${params.toString()}`);
        setVendors(data.vendors ?? []);
        setPagination(prev => ({ ...prev, total: data.total, totalPages: data.totalPages, page: data.page }));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load vendors.');
      } finally {
        setLoading(false);
      }
    };
    loadVendors();
  }, [api, pagination.page, pagination.pageSize, debouncedSearchTerm, filterStatus]);

  const reloadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: pagination.pageSize, search: debouncedSearchTerm, status: filterStatus });
      const { data } = await api.get(`/admin/vendors?${params.toString()}`);
      setVendors(data.vendors ?? []);
      setPagination(prev => ({ ...prev, total: data.total, totalPages: data.totalPages, page: data.page }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reload vendors.');
    }
  }, [api, pagination.page, pagination.pageSize, debouncedSearchTerm, filterStatus]);

  const handleSave = useCallback(async (vendorData) => {
    try {
      const payload = {
        ...vendorData,
        createLogin: Boolean(vendorData.createLogin) && Boolean(vendorData.email?.trim()),
        contactName: vendorData.contactName || '',
      };

      if (vendorData.id) {
        await api.put(`/admin/vendors/${vendorData.id}`, payload);
      } else {
        await api.post('/admin/vendors', payload);
      }
      setEditVendor(null);
      await reloadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vendor.');
    }
  }, [api, reloadData]);

  const handleDelete = useCallback(async (vendorId) => {
    if (window.confirm('Are you sure you want to delete this vendor? This cannot be undone.')) {
      try {
        await api.delete(`/admin/vendors/${vendorId}`);
        await reloadData();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete vendor.');
      }
    }
  }, [api, reloadData]);

  const startNewVendor = () => {
    setEditVendor({
      name: '',
      email: '',
      phone: '',
      baseRate: '',
      rating: '4.0',
      speed: '60',
      isActive: true,
      contactName: '',
      createLogin: true,
    });
  };

  if (loading) {
    return <LoadingSpinner label="Loading vendors..." />;
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Vendor Management</h1>
        <button
          onClick={startNewVendor}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
        >
          <PlusCircle className="h-5 w-5" />
          New Vendor
        </button>
      </header>

      {error && <MessageBox message={error} tone="error" onClose={() => setError('')} />}

      {editVendor && (
        <VendorForm
          vendor={editVendor}
          onSave={handleSave}
          onCancel={() => setEditVendor(null)}
        />
      )}

      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              // Use a different state for input to avoid re-fetching on every keystroke
              // For simplicity here, we'll just use searchTerm directly.
              // A useDebounce hook would be ideal in a real app.
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {vendors.length > 0 ? (
          vendors.map((vendor) => (
          <div key={vendor.id} className="rounded-lg bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{vendor.name}</p>
                <p className="text-sm text-slate-500">{vendor.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${vendor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() =>
                    setEditVendor({
                      ...vendor,
                      contactName: '',
                      createLogin: false,
                    })
                  }
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(vendor.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
              </div>
            </div>
          </div>
          ))
        ) : (
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <p>No vendors match your current filters.</p>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {pagination.total > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <p className="text-slate-600">
            Showing <span className="font-semibold">{(pagination.page - 1) * pagination.pageSize + 1}</span> to <span className="font-semibold">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of <span className="font-semibold">{pagination.total}</span> vendors
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const VendorForm = ({ vendor, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    ...vendor,
    contactName: vendor.contactName ?? '',
    createLogin: vendor.createLogin ?? false,
  });

  useEffect(() => {
    setFormData({
      ...vendor,
      contactName: vendor.contactName ?? '',
      createLogin: vendor.createLogin ?? false,
    });
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-lg font-semibold">{formData.id ? 'Edit Vendor' : 'Create New Vendor'}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField name="name" label="Name" value={formData.name} onChange={handleChange} required />
        <InputField name="email" label="Email" type="email" value={formData.email} onChange={handleChange} />
        <InputField name="phone" label="Phone" value={formData.phone} onChange={handleChange} />
        <InputField name="baseRate" label="Base Rate (per km)" type="number" value={formData.baseRate} onChange={handleChange} />
        <InputField name="rating" label="Rating (1-5)" type="number" step="0.1" value={formData.rating} onChange={handleChange} />
        <InputField name="speed" label="Avg. Speed (km/h)" type="number" value={formData.speed} onChange={handleChange} />
        <InputField name="contactName" label="Transporter Contact Name" value={formData.contactName} onChange={handleChange} />
      </div>
      <div className="mt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
          />
          Active
        </label>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="createLogin"
              checked={Boolean(formData.createLogin)}
              onChange={handleChange}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              disabled={!formData.email?.trim()}
            />
            Provision transporter portal login
          </label>
          <p className="text-xs text-slate-500 md:text-right">
            {formData.email?.trim()
              ? 'We will create/send credentials to this email so the transporter can access quotes and assignments.'
              : 'An email address is required to generate transporter credentials.'}
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <X className="mr-1 inline h-4 w-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Save className="h-4 w-4" />
          Save Vendor
        </button>
      </div>
    </form>
  );
};

const InputField = ({ label, ...props }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
    <input
      {...props}
      className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
    />
  </div>
);

export default VendorManagementPage;

