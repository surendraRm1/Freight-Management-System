import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CloudUpload, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const formatStatus = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const KycUploadPage = () => {
  const { api } = useAuth();

  const [pendingShipments, setPendingShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [documentType, setDocumentType] = useState('driver');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [lrDate, setLrDate] = useState('');

  const loadPendingShipments = useCallback(async () => {
    try {
      setErrorMessage('');
      setRefreshing(true);
      const response = await api.get('/compliance/kyc/pending');
      const payload = response.data;
      const normalized = Array.isArray(payload) ? payload : payload?.shipments || [];
      setPendingShipments(normalized);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Unable to load pending shipments.');
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    loadPendingShipments();
  }, [loadPendingShipments]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return undefined;
    const timer = setTimeout(() => setErrorMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (documentType !== 'lr') {
      setLrNumber('');
      setLrDate('');
    }
  }, [documentType]);

  const hasPending = useMemo(
    () => pendingShipments.some((shipment) => shipment.requiresAction),
    [pendingShipments],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedShipmentId || !file) {
      setErrorMessage('Select a shipment and choose a file before uploading.');
      return;
    }

    if (documentType === 'lr' && !lrNumber.trim()) {
      setErrorMessage('Enter the LR number before uploading.');
      return;
    }

    let endpoint = '/compliance/kyc/driver';
    if (documentType === 'vehicle') {
      endpoint = '/compliance/kyc/vehicle';
    } else if (documentType === 'lr') {
      endpoint = '/compliance/lr';
    }

    const form = new FormData();
    form.append('shipmentId', selectedShipmentId);
    form.append('document', file);
    if (documentType === 'lr') {
      form.append('lrNumber', lrNumber.trim());
      if (lrDate) {
        form.append('issuedAt', lrDate);
      }
    }

    try {
      setUploading(true);
      await api.post(endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMessage('Document uploaded successfully.');
      setFile(null);
      setSelectedShipmentId('');
      setLrNumber('');
      setLrDate('');
      await loadPendingShipments();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to upload compliance document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">KYC compliance hub</h1>
        <p className="text-sm text-slate-500">
          Upload driver, vehicle, and lorry receipt documents to unlock pickups. Choose a shipment to
          get started.
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-slate-700">Shipment</span>
              <select
                value={selectedShipmentId}
                onChange={(event) => setSelectedShipmentId(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select shipment</option>
                {pendingShipments.map((shipment) => (
                  <option key={shipment.id} value={shipment.id}>
                    #{shipment.trackingNumber || shipment.id} • {shipment.fromLocation} →
                    {` ${shipment.toLocation}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-slate-700">Document type</span>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="driver">Driver KYC</option>
                <option value="vehicle">Vehicle KYC</option>
                <option value="lr">Lorry receipt</option>
              </select>
            </label>
          </div>

          {documentType === 'lr' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-semibold text-slate-700">LR number</span>
                <input
                  type="text"
                  value={lrNumber}
                  onChange={(event) => setLrNumber(event.target.value)}
                  placeholder="Enter LR number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-semibold text-slate-700">Issued date</span>
                <input
                  type="date"
                  value={lrDate}
                  onChange={(event) => setLrDate(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-slate-700">Upload document</span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">
              Supported formats: PDF, JPEG, PNG. Max size 10 MB.
            </span>
          </label>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={loadPendingShipments}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh queue
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <CloudUpload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Shipments needing KYC</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {pendingShipments.length} shipments
          </span>
        </div>

        {refreshing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Syncing latest compliance status...
          </div>
        )}

        {!hasPending && !refreshing ? (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-600">
            All driver and vehicle documents are up to date. Great work!
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {pendingShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="rounded-xl border border-slate-100 p-4 shadow-sm transition hover:border-blue-400 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      #{shipment.trackingNumber || shipment.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {shipment.fromLocation} → {shipment.toLocation}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedShipmentId(String(shipment.id))}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Use in form
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-600">Driver KYC</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
                      {formatStatus(shipment.driverStatus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-600">Vehicle KYC</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
                      {formatStatus(shipment.vehicleStatus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-600">Lorry receipt</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
                      {formatStatus(shipment.lorryReceiptStatus)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <p>Created {formatDateTime(shipment.createdAt)}</p>
                  <Link
                    to={`/shipments/${shipment.id}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    View details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default KycUploadPage;
