import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(value || 0);

const TransporterDashboard = () => {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hasAccess = ['TRANSPORTER', 'AGENT', 'COMPANY_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const hasVendorContext = Boolean(user?.vendorId);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(user?.vendorId ? String(user.vendorId) : '');

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!hasAccess) {
        setLoading(false);
        return;
      }
      if (!hasVendorContext && !selectedVendorId) {
        setLoading(false);
        return;
      }
      try {
        const url = selectedVendorId
          ? `/transporter/analytics/overview?vendorId=${selectedVendorId}`
          : '/transporter/analytics/overview';
        const response = await api.get(url);
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load transporter analytics.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [api, hasAccess, hasVendorContext, selectedVendorId]);

  useEffect(() => {
    const needsVendorSelection = !hasVendorContext && ['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
    if (!needsVendorSelection) return;
    let mounted = true;
    const fetchVendors = async () => {
      try {
        const response = await api.get(`/admin/vendors/list?ts=${Date.now()}`);
        if (mounted) {
          setVendorOptions(response.data?.vendors || []);
          if (!selectedVendorId && response.data?.vendors?.length) {
            setSelectedVendorId(String(response.data.vendors[0].id));
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load vendors.');
        }
      }
    };
    fetchVendors();
    return () => {
      mounted = false;
    };
  }, [api, hasVendorContext, selectedVendorId, user?.role]);

  if (!hasAccess) {
    return <p className="text-sm text-slate-500">Transporter dashboard is limited to transporter roles.</p>;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
        Loading transporter overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm text-rose-600 font-medium">
        {error}
      </div>
    );
  }

  const {
    quotePipeline = { pending: 0, responded: 0, approved: 0, declined: 0, backlog: [] },
    assignmentQueue = [],
    performance = {},
    driverCompliance = {},
  } = data || {};

  const assignmentActive = useMemo(
    () => assignmentQueue.filter((item) => item.status !== 'DELIVERED'),
    [assignmentQueue],
  );
  const completedAssignments = useMemo(
    () => assignmentQueue.filter((item) => item.status === 'DELIVERED'),
    [assignmentQueue],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-indigo-500 font-semibold">Transporter console</p>
        <h1 className="text-2xl font-bold text-slate-900">Pipeline & assignments</h1>
      </div>

      {vendorOptions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-700">Select vendor</p>
          <select
            value={selectedVendorId}
            onChange={(event) => setSelectedVendorId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!data && !loading && selectedVendorId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No analytics available for the selected vendor yet.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs uppercase text-slate-500">Pending quotes</p>
              <p className="text-3xl font-bold text-slate-900">{formatNumber(quotePipeline.pending)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs uppercase text-slate-500">Responded</p>
              <p className="text-3xl font-bold text-emerald-600">{formatNumber(quotePipeline.responded)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs uppercase text-slate-500">Approved</p>
              <p className="text-3xl font-bold text-blue-600">{formatNumber(quotePipeline.approved)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs uppercase text-slate-500">Declined</p>
              <p className="text-3xl font-bold text-rose-600">{formatNumber(quotePipeline.declined)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Quote backlog</p>
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-2">
                {quotePipeline.backlog.map((quote) => (
                  <div key={quote.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">
                      {quote.quoteRequest?.fromLocation} → {quote.quoteRequest?.toLocation}
                    </p>
                    <p className="text-xs text-slate-500">
                      Created {new Date(quote.quoteRequest?.createdAt || Date.now()).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      Expires {quote.expiresAt ? new Date(quote.expiresAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                ))}
                {!quotePipeline.backlog.length && <p className="text-xs text-slate-500">No pending invitations.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Performance</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xs uppercase text-slate-500">Delivered</p>
                  <p className="text-2xl font-bold text-slate-900">{formatNumber(data.performance.deliveredCount)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-xs uppercase text-emerald-600">POD compliance</p>
                  <p className="text-2xl font-bold text-emerald-700">{data.performance.podCompliance || 0}%</p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <p className="text-xs uppercase text-indigo-600">Active jobs</p>
                  <p className="text-2xl font-bold text-indigo-700">{formatNumber(data.performance.activeAssignments)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Avg response time: {data.performance.averageResponseHours || 0}h
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Assignment queue</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-500">In progress</p>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-2">
                  {assignmentActive.map((shipment) => (
                    <div key={shipment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">{shipment.trackingNumber || `Shipment #${shipment.id}`}</p>
                      <p className="text-xs text-slate-500">{shipment.route}</p>
                      <p className="text-xs text-slate-500">
                        ETA {shipment.eta ? new Date(shipment.eta).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  ))}
                  {!assignmentActive.length && <p className="text-xs text-slate-500">No active assignments.</p>}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Delivered</p>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-2">
                  {completedAssignments.map((shipment) => (
                    <div key={shipment.id} className="rounded-lg border border-slate-100 bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-900">{shipment.trackingNumber || `Shipment #${shipment.id}`}</p>
                      <p className="text-xs text-slate-500">{shipment.route}</p>
                      <p className="text-xs text-slate-500">
                        Delivered {shipment.deliveryTime ? new Date(shipment.deliveryTime).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  ))}
                  {!completedAssignments.length && <p className="text-xs text-slate-500">No delivered jobs yet.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Driver compliance</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs uppercase text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">{formatNumber(driverCompliance.totalDrivers)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-xs uppercase text-emerald-600">Active</p>
                <p className="text-2xl font-bold text-emerald-700">{formatNumber(driverCompliance.activeDrivers)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center">
                <p className="text-xs uppercase text-rose-600">Flagged</p>
                <p className="text-2xl font-bold text-rose-700">
                  {formatNumber(driverCompliance.flaggedDrivers?.length || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 text-sm">
              {driverCompliance.flaggedDrivers?.map((driver) => (
                <div key={driver.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{driver.name}</p>
                  <p className="text-xs text-slate-500">Phone: {driver.phone || 'N/A'}</p>
                  <p className="text-xs text-slate-500">License: {driver.licenseNumber || 'Missing'}</p>
                </div>
              ))}
              {!driverCompliance.flaggedDrivers?.length && (
                <p className="text-xs text-slate-500">All drivers have up-to-date information.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransporterDashboard;
