import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Package,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Phone,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useSyncMutation from '../../hooks/useSyncMutation';
import MessageBox from '../../components/ui/MessageBox';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const countdownLabel = (value) => {
  if (!value) return 'No SLA';
  const expires = new Date(value);
  const diffMs = expires.getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  if (days > 0) {
    const remHours = Math.floor((diffMinutes - days * 1440) / 60);
    return `${days}d ${remHours}h`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return 'N/A';
  return currencyFormatter.format(asNumber);
};

const TransporterInbox = () => {
  const { api, user } = useAuth();
  const runSyncMutation = useSyncMutation();
  const [loading, setLoading] = useState(true);
  const [quoteResponses, setQuoteResponses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quoteForms, setQuoteForms] = useState({});
  const [assignmentNotes, setAssignmentNotes] = useState({});
  const [quoteSubmitting, setQuoteSubmitting] = useState({});
  const [assignmentSubmitting, setAssignmentSubmitting] = useState({});
  const [driverForms, setDriverForms] = useState({});
  const [driverSubmitting, setDriverSubmitting] = useState({});
  const [locationForms, setLocationForms] = useState({});
  const [locationSubmitting, setLocationSubmitting] = useState({});
  const [toast, setToast] = useState({ message: '', tone: 'info' });
  const [error, setError] = useState('');

  const transporterName = useMemo(
    () => user?.vendor?.name || 'Your transporter team',
    [user],
  );

  const awaitingConfirmation = useMemo(
    () =>
      assignments.filter(
        (shipment) =>
          shipment.status !== 'ACCEPTED'
          && shipment.status !== 'REJECTED',
      ),
    [assignments],
  );

  const awaitingDriverInfo = useMemo(
    () =>
      assignments.filter((shipment) => shipment.status === 'ACCEPTED'),
    [assignments],
  );

  const formatInputDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  const closeToast = useCallback(() => {
    setToast({ message: '', tone: 'info' });
  }, []);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [quotesRes, assignmentsRes] = await Promise.all([
        api.get('/transporter/quotes'),
        api.get('/transporter/assignments'),
      ]);

      setQuoteResponses(quotesRes.data.responses || []);
      setAssignments(assignmentsRes.data.assignments || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load transporter inbox.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    setDriverForms((prev) => {
      const next = { ...prev };
      awaitingDriverInfo.forEach((shipment) => {
        if (!next[shipment.id]) {
          next[shipment.id] = {
            driverName: shipment.assignedDriver || '',
            driverPhone: shipment.driverPhone || '',
            driverPhotoUrl: shipment.driverPhotoUrl || '',
            vehicleType: shipment.vehicleType || '',
            vehicleModel: shipment.vehicleModel || '',
            vehicleRegistration: shipment.vehicleRegistration || '',
            driverEta: formatInputDateTime(shipment.driverEta),
          };
        }
      });
      return next;
    });

    setLocationForms((prev) => {
      const next = { ...prev };
      awaitingDriverInfo.forEach((shipment) => {
        if (!next[shipment.id]) {
          next[shipment.id] = {
            latitude: shipment.driverLastKnownLat ?? '',
            longitude: shipment.driverLastKnownLng ?? '',
            locationLabel: '',
            eta: formatInputDateTime(shipment.driverEta),
          };
        }
      });
      return next;
    });
  }, [awaitingDriverInfo]);

  const updateQuoteForm = (id, field, value) => {
    setQuoteForms((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const submitQuoteResponse = async (id) => {
    const form = quoteForms[id] || {};

    if (!form.quotedPrice || !form.estimatedDelivery) {
      setToast({
        message: 'Provide price and estimated delivery before submitting a quotation.',
        tone: 'warning',
      });
      return;
    }

    setQuoteSubmitting((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/transporter/quotes/${id}/respond`, {
        quotedPrice: parseFloat(form.quotedPrice),
        estimatedDelivery: form.estimatedDelivery,
        transporterNotes: form.transporterNotes || '',
      });

      setQuoteResponses((prev) => prev.filter((item) => item.id !== id));
      setQuoteForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setToast({
        message: 'Quotation sent successfully. We will notify the shipper.',
        tone: 'success',
      });
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Failed to submit quotation.',
        tone: 'error',
      });
    } finally {
      setQuoteSubmitting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const declineQuote = async (id) => {
    const form = quoteForms[id] || {};

    setQuoteSubmitting((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/transporter/quotes/${id}/respond`, {
        action: 'DECLINE',
        transporterNotes: form.transporterNotes || '',
      });

      setQuoteResponses((prev) => prev.filter((item) => item.id !== id));
      setQuoteForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setToast({
        message: 'You declined this quotation request.',
        tone: 'info',
      });
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Failed to decline quotation.',
        tone: 'error',
      });
    } finally {
      setQuoteSubmitting((prev) => ({ ...prev, [id]: false }));
    }
  };

const handleAssignmentAction = async (shipment, action) => {
  const shipmentId = shipment.id;
  const notes = assignmentNotes[shipmentId]?.notes || '';
  const quoteResponseId = shipment.transporterQuote?.id;

  setAssignmentSubmitting((prev) => ({ ...prev, [shipmentId]: true }));
  try {
    const request = quoteResponseId
      ? (client) =>
          client.post(`/quotes/responses/${quoteResponseId}/consent`, {
            action,
            note: notes,
          })
      : (client) =>
          client.post(`/transporter/assignments/${shipmentId}/respond`, {
            action: action === 'ACCEPT' ? 'ACCEPT' : 'REJECT',
            notes,
          });

    const queuePayload = quoteResponseId
      ? {
          entityType: 'QUOTE_RESPONSE',
          entityId: quoteResponseId,
          action: action === 'ACCEPT' ? 'RESPOND_QUOTE_RESPONSE' : 'DECLINE_QUOTE_RESPONSE',
          payload: { responseId: quoteResponseId, action, notes },
        }
      : {
          entityType: 'SHIPMENT',
          entityId: shipmentId,
          action: action === 'ACCEPT' ? 'ACCEPT_ASSIGNMENT' : 'REJECT_ASSIGNMENT',
          payload: { shipmentId, action, notes },
        };

    const result = await runSyncMutation({
      request,
      queue: queuePayload,
    });

    if (!result.queued) {
      setAssignments((prev) => prev.filter((item) => item.id !== shipmentId));
      setAssignmentNotes((prev) => {
        const next = { ...prev };
        delete next[shipmentId];
        return next;
      });
      await loadInbox();
    }

    setToast({
      message:
        result.queued
          ? 'Offline: assignment response queued and will sync automatically.'
          : action === 'ACCEPT'
            ? 'Booking confirmed. Dispatcher notified.'
            : 'Booking declined. Shipper will be alerted.',
      tone: result.queued ? 'warning' : action === 'ACCEPT' ? 'success' : 'warning',
    });
  } catch (err) {
    setToast({
      message: err.response?.data?.error || err.message || 'Failed to update assignment.',
      tone: 'error',
    });
  } finally {
    setAssignmentSubmitting((prev) => ({ ...prev, [shipmentId]: false }));
  }
};

const updateDriverForm = (id, field, value) => {
  setDriverForms((prev) => ({
    ...prev,
    [id]: {
      ...(prev[id] || {}),
      [field]: value,
    },
  }));
};

const handleDriverInfoSubmit = async (shipment) => {
  const shipmentId = shipment.id;
  const form = driverForms[shipmentId] || {};

  if (!form.driverName || !form.driverPhone || !form.vehicleType || !form.vehicleRegistration) {
    setToast({
      message: 'Driver name, phone, vehicle type, and registration are required.',
      tone: 'warning',
    });
    return;
  }

  setDriverSubmitting((prev) => ({ ...prev, [shipmentId]: true }));
  try {
    const payload = {
      driverName: form.driverName,
      driverPhone: form.driverPhone,
      driverPhotoUrl: form.driverPhotoUrl || undefined,
      vehicleType: form.vehicleType,
      vehicleModel: form.vehicleModel || undefined,
      vehicleRegistration: form.vehicleRegistration,
      driverEta: form.driverEta || undefined,
    };

    const result = await runSyncMutation({
      request: (client) => client.post(`/transporter/shipments/${shipmentId}/driver-info`, payload),
      queue: {
        entityType: 'SHIPMENT',
        entityId: shipmentId,
        action: 'UPDATE_DRIVER_INFO',
        payload: { shipmentId, ...payload },
      },
    });

    setToast({
      message: result.queued
        ? 'Offline: driver details queued and will sync automatically.'
        : 'Driver and vehicle details saved.',
      tone: result.queued ? 'warning' : 'success',
    });
    if (!result.queued) {
      await loadInbox();
    }
  } catch (err) {
    setToast({
      message: err.response?.data?.error || err.message || 'Failed to save driver details.',
      tone: 'error',
    });
  } finally {
    setDriverSubmitting((prev) => ({ ...prev, [shipmentId]: false }));
  }
};

const updateLocationForm = (id, field, value) => {
  setLocationForms((prev) => ({
    ...prev,
    [id]: {
      ...(prev[id] || {}),
      [field]: value,
    },
  }));
};

const handleLocationSubmit = async (shipment) => {
  const shipmentId = shipment.id;
  const form = locationForms[shipmentId] || {};

  if (form.latitude === '' || form.longitude === '') {
    setToast({
      message: 'Latitude and longitude are required to update location.',
      tone: 'warning',
    });
    return;
  }

  setLocationSubmitting((prev) => ({ ...prev, [shipmentId]: true }));
  try {
    const payload = {
      latitude: form.latitude,
      longitude: form.longitude,
      eta: form.eta || undefined,
      locationLabel: form.locationLabel || undefined,
    };

    const result = await runSyncMutation({
      request: (client) => client.post(`/transporter/shipments/${shipmentId}/location`, payload),
      queue: {
        entityType: 'SHIPMENT',
        entityId: shipmentId,
        action: 'UPDATE_DRIVER_LOCATION',
        payload: { shipmentId, ...payload },
      },
    });

    setToast({
      message: result.queued
        ? 'Offline: driver location queued and will sync automatically.'
        : 'Driver location updated.',
      tone: result.queued ? 'warning' : 'success',
    });
    if (!result.queued) {
      await loadInbox();
    }
  } catch (err) {
    setToast({
      message: err.response?.data?.error || err.message || 'Failed to update driver location.',
      tone: 'error',
    });
  } finally {
    setLocationSubmitting((prev) => ({ ...prev, [shipmentId]: false }));
  }
};

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-widest text-blue-200">Transporter centre</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {transporterName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-blue-100">
          Quotation requests and live assignments waiting for your action appear here. Respond quickly
          to keep lanes running smoothly.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Quotation requests</h2>
                <p className="text-sm text-slate-500">
                  Price out new lanes and share your best ETA to win the job.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {quoteResponses.length} pending
              </span>
            </div>

            {quoteResponses.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No open quotation requests. Tara will notify you when new routes arrive.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {quoteResponses.map((response) => {
                  const form = quoteForms[response.id] || {};
                  return (
                    <div
                      key={response.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Route</p>
                            <p className="font-semibold text-slate-900">
                              {response.quoteRequest.fromLocation}
                            </p>
                            <p className="text-sm text-slate-500">
                              to {response.quoteRequest.toLocation}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Package className="mt-0.5 h-5 w-5 text-slate-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Load</p>
                            <p className="font-semibold text-slate-900">
                              {response.quoteRequest.weight} kg · {response.quoteRequest.shipmentType}
                            </p>
                            <p className="text-sm text-slate-500">
                              Urgency: {response.quoteRequest.urgency}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="mt-0.5 h-5 w-5 text-slate-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Requested</p>
                            <p className="font-semibold text-slate-900">
                              {formatDate(response.quoteRequest.createdAt)}
                            </p>
                            <p className="text-sm text-slate-500">
                              By {response.quoteRequest.createdBy?.name || 'Shipper'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Quoted price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.quotedPrice || ''}
                            onChange={(event) =>
                              updateQuoteForm(response.id, 'quotedPrice', event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Estimated delivery
                          </label>
                          <input
                            type="datetime-local"
                            value={form.estimatedDelivery || ''}
                            onChange={(event) =>
                              updateQuoteForm(response.id, 'estimatedDelivery', event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <textarea
                          rows={2}
                          placeholder="Add a short note for the shipper (optional)"
                          value={form.transporterNotes || ''}
                          onChange={(event) =>
                            updateQuoteForm(response.id, 'transporterNotes', event.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 md:max-w-xl"
                        />

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => submitQuoteResponse(response.id)}
                            disabled={quoteSubmitting[response.id]}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {quoteSubmitting[response.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 -rotate-45" />
                            )}
                            Send quotation
                          </button>
                          <button
                            type="button"
                            onClick={() => declineQuote(response.id)}
                            disabled={quoteSubmitting[response.id]}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pending assignments</h2>
                <p className="text-sm text-slate-500">
                  Confirm jobs waiting on your acceptance to start planning the load.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {awaitingConfirmation.length} pending
              </span>
            </div>

            {awaitingConfirmation.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No shipments waiting on confirmation.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {awaitingConfirmation.map((shipment) => {
                  const consentDetails = shipment.transporterQuote;
                  const expiresAt = consentDetails?.expiresAt;
                  const slaCountdown = countdownLabel(expiresAt);
                  const isExpired = Boolean(consentDetails && expiresAt && new Date(expiresAt).getTime() <= Date.now());
                  const disableActions =
                    assignmentSubmitting[shipment.id] || (consentDetails && isExpired);

                  return (
                    <div
                      key={shipment.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {consentDetails ? 'Awaiting booking consent' : 'Pending assignment'}
                        </span>
                        {consentDetails && (
                          <div
                            className={`flex items-center gap-2 text-sm ${
                              isExpired ? 'text-red-600' : 'text-slate-600'
                            }`}
                          >
                            {isExpired ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                            <span>{slaCountdown}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-4">
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Route</p>
                            <p className="font-semibold text-slate-900">{shipment.fromLocation}</p>
                            <p className="text-sm text-slate-500">to {shipment.toLocation}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Package className="mt-0.5 h-5 w-5 text-slate-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Load</p>
                            <p className="font-semibold text-slate-900">
                              {shipment.weight} kg x {shipment.shipmentType}
                            </p>
                            <p className="text-sm text-slate-500">Urgency: {shipment.urgency}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="mt-0.5 h-5 w-5 text-slate-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Requested</p>
                            <p className="font-semibold text-slate-900">
                              {formatDate(shipment.createdAt)}
                            </p>
                            <p className="text-sm text-slate-500">
                              Deliver by: {formatDate(shipment.estimatedDelivery)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Shipper</p>
                            <p className="font-semibold text-slate-900">{shipment.user?.name}</p>
                            <p className="text-sm text-slate-500">{shipment.user?.email}</p>
                          </div>
                        </div>
                      </div>

                      {consentDetails && (
                        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <div className="flex flex-wrap items-center gap-4">
                            <span>
                              <strong>Quoted price:</strong> {formatCurrency(consentDetails.quotedPrice)}
                            </span>
                            <span>
                              <strong>ETA:</strong> {formatDate(consentDetails.estimatedDelivery)}
                            </span>
                            {consentDetails.transporterNotes && (
                              <span className="min-w-[200px] flex-1">
                                <strong>Notes:</strong> {consentDetails.transporterNotes}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <textarea
                          rows={2}
                          placeholder="Notes back to dispatcher (optional)"
                          value={assignmentNotes[shipment.id]?.notes || ''}
                          onChange={(event) =>
                            setAssignmentNotes((prev) => ({
                              ...prev,
                              [shipment.id]: {
                                ...(prev[shipment.id] || {}),
                                notes: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 md:max-w-xl"
                        />

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleAssignmentAction(shipment, 'ACCEPT')}
                            disabled={disableActions}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {assignmentSubmitting[shipment.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Confirm booking
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignmentAction(shipment, 'DECLINE')}
                            disabled={assignmentSubmitting[shipment.id]}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>

                      {consentDetails && isExpired && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>SLA expired. Please contact the dispatcher to reissue the booking.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-10 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Driver &amp; vehicle onboarding</h3>
                  <p className="text-sm text-slate-500">
                    Share driver credentials and vehicle details for accepted loads. This unlocks live tracking, call, and share features for the shipper.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {awaitingDriverInfo.length} to update
                </span>
              </div>

              {awaitingDriverInfo.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-6 py-10 text-center text-sm text-emerald-700">
                  All accepted shipments already have driver and vehicle information assigned.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {awaitingDriverInfo.map((shipment) => {
                    const driverForm = driverForms[shipment.id] || {};
                    const locationForm = locationForms[shipment.id] || {};
                    const hasDriver =
                      Boolean(shipment.assignedDriver)
                      && Boolean(shipment.driverPhone)
                      && Boolean(shipment.vehicleRegistration);
                    const lastUpdate = shipment.driverLocationUpdatedAt
                      ? formatDate(shipment.driverLocationUpdatedAt)
                      : null;

                    return (
                      <div
                        key={shipment.id}
                        className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              Accepted booking
                            </span>
                            <p className="mt-2 text-sm text-slate-600">
                              {shipment.fromLocation} → {shipment.toLocation} •{' '}
                              {shipment.weight} kg {shipment.shipmentType}
                            </p>
                          </div>
                          {hasDriver && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Driver details on file
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Driver name</span>
                            <input
                              type="text"
                              value={driverForm.driverName ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'driverName', event.target.value)
                              }
                              placeholder="e.g. Ramesh Kumar"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Driver mobile</span>
                            <input
                              type="tel"
                              value={driverForm.driverPhone ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'driverPhone', event.target.value)
                              }
                              placeholder="10-digit mobile number"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Driver photo URL</span>
                            <input
                              type="url"
                              value={driverForm.driverPhotoUrl ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'driverPhotoUrl', event.target.value)
                              }
                              placeholder="https://..."
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Vehicle type</span>
                            <input
                              type="text"
                              value={driverForm.vehicleType ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'vehicleType', event.target.value)
                              }
                              placeholder="e.g. 32FT Container"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Vehicle model / name</span>
                            <input
                              type="text"
                              value={driverForm.vehicleModel ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'vehicleModel', event.target.value)
                              }
                              placeholder="Optional"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Vehicle registration</span>
                            <input
                              type="text"
                              value={driverForm.vehicleRegistration ?? ''}
                              onChange={(event) =>
                                updateDriverForm(
                                  shipment.id,
                                  'vehicleRegistration',
                                  event.target.value.toUpperCase(),
                                )
                              }
                              placeholder="TN01AB1234"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm text-slate-600">
                            <span className="font-semibold text-slate-800">Driver ETA</span>
                            <input
                              type="datetime-local"
                              value={driverForm.driverEta ?? ''}
                              onChange={(event) =>
                                updateDriverForm(shipment.id, 'driverEta', event.target.value)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleDriverInfoSubmit(shipment)}
                            disabled={driverSubmitting[shipment.id]}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {driverSubmitting[shipment.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Save driver details
                          </button>
                          {shipment.driverPhone && (
                            <a
                              href={`tel:${shipment.driverPhone}`}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600"
                            >
                              <Phone className="h-4 w-4" />
                              Call driver
                            </a>
                          )}
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Live location updates</p>
                              <p className="text-xs text-slate-500">
                                Share the driver’s last known coordinates to power the live tracking widget.
                              </p>
                            </div>
                            {lastUpdate && (
                              <p className="text-xs text-slate-500">Last update: {lastUpdate}</p>
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                              Latitude
                              <input
                                type="number"
                                step="0.0001"
                                value={locationForm.latitude ?? ''}
                                onChange={(event) =>
                                  updateLocationForm(shipment.id, 'latitude', event.target.value)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                              Longitude
                              <input
                                type="number"
                                step="0.0001"
                                value={locationForm.longitude ?? ''}
                                onChange={(event) =>
                                  updateLocationForm(shipment.id, 'longitude', event.target.value)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                              Location (optional)
                              <input
                                type="text"
                                value={locationForm.locationLabel ?? ''}
                                onChange={(event) =>
                                  updateLocationForm(
                                    shipment.id,
                                    'locationLabel',
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. Attibele Toll"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                              Revised ETA (optional)
                              <input
                                type="datetime-local"
                                value={locationForm.eta ?? ''}
                                onChange={(event) =>
                                  updateLocationForm(shipment.id, 'eta', event.target.value)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              />
                            </label>
                          </div>

                          <div className="mt-3 flex flex-wrap justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => handleLocationSubmit(shipment)}
                              disabled={locationSubmitting[shipment.id]}
                              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-600 transition hover:border-blue-400 disabled:opacity-50"
                            >
                              {locationSubmitting[shipment.id] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Share2 className="h-4 w-4" />
                              )}
                              Push live update
                            </button>
                            {shipment.driverLastKnownLat && shipment.driverLastKnownLng && (
                              <span className="text-xs text-slate-500">
                                Current coordinates: {shipment.driverLastKnownLat.toFixed(4)},{' '}
                                {shipment.driverLastKnownLng.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>        </>
      )}

      <MessageBox message={toast.message} tone={toast.tone} onClose={closeToast} />
    </div>
  );
};

export default TransporterInbox;






