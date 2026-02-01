import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusCircle, Save, X, Loader2, Pencil, Trash2, RefreshCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MessageBox from '../../components/ui/MessageBox';

const defaultDriverForm = () => ({
  name: '',
  phone: '',
  licenseNumber: '',
  vehicleNumber: '',
  notes: '',
  isActive: true,
});

const sanitizePayload = (form) => ({
  name: form.name.trim(),
  phone: form.phone.trim() || null,
  licenseNumber: form.licenseNumber.trim() || null,
  vehicleNumber: form.vehicleNumber.trim() || null,
  notes: form.notes.trim() || null,
  isActive: Boolean(form.isActive),
});

const DriverDirectoryPage = () => {
  const { api, user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driverForm, setDriverForm] = useState(defaultDriverForm());
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState({ message: '', tone: 'info' });
  const [error, setError] = useState('');

  const transporterLabel = useMemo(() => user?.vendor?.name || 'Transporter', [user]);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/transporter/drivers');
      setDrivers(data.drivers || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load driver records.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const resetForm = () => {
    setDriverForm(defaultDriverForm());
    setEditingId(null);
  };

  const handleFieldChange = (event) => {
    const { name, type, value, checked } = event.target;
    setDriverForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!driverForm.name.trim()) {
      setToast({ message: 'Driver name is required.', tone: 'warning' });
      return;
    }

    setSaving(true);
    setToast({ message: '', tone: 'info' });
    try {
      const payload = sanitizePayload(driverForm);
      if (editingId) {
        await api.put(`/transporter/drivers/${editingId}`, payload);
        setToast({ message: 'Driver updated successfully.', tone: 'success' });
      } else {
        await api.post('/transporter/drivers', payload);
        setToast({ message: 'Driver added successfully.', tone: 'success' });
      }
      resetForm();
      await loadDrivers();
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Failed to save driver.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (driver) => {
    setEditingId(driver.id);
    setDriverForm({
      name: driver.name || '',
      phone: driver.phone || '',
      licenseNumber: driver.licenseNumber || '',
      vehicleNumber: driver.vehicleNumber || '',
      notes: driver.notes || '',
      isActive: driver.isActive,
    });
  };

  const handleArchive = async (driverId) => {
    if (!window.confirm('Archive this driver? They can be reactivated later.')) return;
    try {
      await api.delete(`/transporter/drivers/${driverId}`);
      setToast({ message: 'Driver archived.', tone: 'info' });
      if (editingId === driverId) {
        resetForm();
      }
      await loadDrivers();
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Failed to archive driver.',
        tone: 'error',
      });
    }
  };

  const handleReactivate = async (driverId) => {
    try {
      await api.put(`/transporter/drivers/${driverId}`, { isActive: true });
      setToast({ message: 'Driver reactivated.', tone: 'success' });
      await loadDrivers();
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Failed to reactivate driver.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 p-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest text-blue-100">Driver directory</p>
        <h1 className="mt-2 text-3xl font-semibold">Keep {transporterLabel} ready for dispatch</h1>
        <p className="mt-3 max-w-2xl text-sm text-blue-100">
          Store your trusted driver and vehicle contacts so assignments can be dispatched instantly.
          Update their details whenever credentials or vehicles change.
        </p>
      </div>

      {error && <MessageBox message={error} tone="error" onClose={() => setError('')} />}
      <MessageBox message={toast.message} tone={toast.tone} onClose={() => setToast({ message: '', tone: 'info' })} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {editingId ? 'Update driver' : 'Add a driver'}
            </h2>
            <p className="text-sm text-slate-500">
              Provide key contact information so your operations team can assign loads smoothly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setToast({ message: '', tone: 'info' });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Driver name *
            <input
              name="name"
              value={driverForm.name}
              onChange={handleFieldChange}
              placeholder="e.g. Ramesh Kumar"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Phone
            <input
              name="phone"
              value={driverForm.phone}
              onChange={handleFieldChange}
              placeholder="+91 98765 43210"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            License number
            <input
              name="licenseNumber"
              value={driverForm.licenseNumber}
              onChange={handleFieldChange}
              placeholder="DL-0420120012345"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Vehicle number
            <input
              name="vehicleNumber"
              value={driverForm.vehicleNumber}
              onChange={handleFieldChange}
              placeholder="KA-01 AB 1234"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Notes
            <textarea
              name="notes"
              value={driverForm.notes}
              onChange={handleFieldChange}
              rows={3}
              placeholder="Any additional remarks (e.g. preferred routes, special permits)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              name="isActive"
              checked={driverForm.isActive}
              onChange={handleFieldChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Active driver
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
              >
                <X className="h-4 w-4" />
                Cancel edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
              {saving ? 'Saving...' : editingId ? 'Update driver' : 'Add driver'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Driver roster</h2>
            <p className="text-sm text-slate-500">
              {drivers.length} {drivers.length === 1 ? 'record' : 'records'} stored.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
            No drivers saved yet. Add your first driver above to speed up assignments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Driver</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Credentials</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {drivers.map((driver) => (
                  <tr key={driver.id} className={driver.isActive ? '' : 'bg-slate-50'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{driver.name}</div>
                      <div className="text-xs text-slate-500">
                        Updated {new Date(driver.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      {!driver.isActive && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{driver.phone || 'Not provided'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">
                        {driver.licenseNumber ? (
                          <>
                            <span className="font-semibold text-slate-600">License:</span> {driver.licenseNumber}
                          </>
                        ) : (
                          <span className="text-slate-500">No licence recorded</span>
                        )}
                      </div>
                      <div className="text-slate-700">
                        {driver.vehicleNumber ? (
                          <>
                            <span className="font-semibold text-slate-600">Vehicle:</span> {driver.vehicleNumber}
                          </>
                        ) : (
                          <span className="text-slate-500">No vehicle assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {driver.notes ? driver.notes : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(driver)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        {driver.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(driver.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(driver.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default DriverDirectoryPage;
