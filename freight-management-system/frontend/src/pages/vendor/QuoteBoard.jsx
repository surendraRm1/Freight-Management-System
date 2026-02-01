import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Loader2,
  MapPin,
  Package,
  Calendar,
  Clock,
  TrendingUp,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react';
import MessageBox from '../../components/ui/MessageBox';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusStyles = {
  PENDING: 'bg-amber-100 text-amber-700',
  RESPONDED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

const QuoteBoard = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', tone: 'info' });

  const closeToast = useCallback(() => setToast({ message: '', tone: 'info' }), []);

  const loadRequests = useCallback(
    async (showScreenLoader = true) => {
      if (showScreenLoader) {
        setLoading(true);
      }
      setError('');
      try {
        const response = await api.get('/quotes');
        setRequests(response.data.requests || []);
        return true;
      } catch (err) {
        const message = err.response?.data?.error || 'Failed to fetch quotation requests.';
        setError(message);
        return false;
      } finally {
        if (showScreenLoader) {
          setLoading(false);
        }
      }
    },
    [api],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const success = await loadRequests(false);
    if (success) {
      setToast({ message: 'Quotes updated successfully.', tone: 'success' });
    } else {
      setToast((prev) =>
        prev?.tone === 'error'
          ? prev
          : { message: 'Unable to refresh quotation requests.', tone: 'error' },
      );
    }
    setRefreshing(false);
  }, [loadRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const approveQuote = async (responseId) => {
    setActionLoading((prev) => ({ ...prev, [responseId]: true }));
    try {
      const response = await api.post(`/quotes/responses/${responseId}/approve`);
      const updated = response.data.approval?.quoteRequest;
      if (updated) {
        setRequests((prev) =>
          prev.map((request) => (request.id === updated.id ? updated : request)),
        );
      }

      setToast({
        message: 'Quotation approved. Shipment created and awaiting transporter acceptance.',
        tone: 'success',
      });
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Unable to approve quotation.',
        tone: 'error',
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [responseId]: false }));
    }
  };

  const awaitingResponses = useMemo(
    () => requests.filter((request) => request.status === 'PENDING'),
    [requests],
  );

  const respondedRequests = useMemo(
    () => requests.filter((request) => request.status === 'RESPONDED'),
    [requests],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-widest text-blue-100">Transporter quotation desk</p>
        <h1 className="mt-2 text-2xl font-semibold">Manage custom quotations</h1>
        <p className="mt-3 max-w-3xl text-sm text-blue-50">
          When a route falls outside your rate cards, request quotations from transporters, review
          their responses, and approve the best fit. Approved quotes instantly spin up shipments ready
          for transporter acceptance.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : null}
          <span>{refreshing ? 'Updating quotes...' : 'Update quotes'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Awaiting transporter response</h2>
                <p className="text-sm text-slate-500">
                  Requests still pending a transporter quotation. Tara will alert you on updates.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {awaitingResponses.length}
              </span>
            </div>

            {awaitingResponses.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No pending requests. Create a new quote from the shipment planner when you need one.
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {awaitingResponses.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="font-semibold text-slate-900">{request.fromLocation}</span>
                          <span className="text-slate-400">→</span>
                          <span>{request.toLocation}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Package className="h-4 w-4 text-slate-500" />
                          <span>{request.weight} kg</span>
                          <span className="text-slate-400">•</span>
                          <span>{request.shipmentType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="h-4 w-4 text-slate-500" />
                          <span>Urgency: {request.urgency}</span>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[request.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                      Quotes requested from:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      {request.responses.map((response) => (
                        <span key={response.id} className="rounded-full border border-slate-200 px-3 py-1">
                          {response.vendor.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Transporter responses</h2>
                <p className="text-sm text-slate-500">
                  Compare submitted prices and approve the best quote to trigger a shipment.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {respondedRequests.length}
              </span>
            </div>

            {respondedRequests.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No responses waiting for approval.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {respondedRequests.map((request) => {
                  const hasApproval = request.status === 'APPROVED' || request.approvedResponseId;
                  return (
                    <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-slate-900">{request.fromLocation}</span>
                            <span className="text-slate-400">→</span>
                            <span>{request.toLocation}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Package className="h-4 w-4 text-slate-500" />
                            <span>{request.weight} kg</span>
                            <span className="text-slate-400">•</span>
                            <span>{request.shipmentType}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span>Urgency: {request.urgency}</span>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[request.status] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {request.responses.map((response) => (
                          <div
                            key={response.id}
                            className={`rounded-2xl border px-4 py-4 text-sm ${
                              response.id === request.approvedResponseId
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <TrendingUp className="h-4 w-4 text-slate-500" />
                                  <span className="font-semibold text-slate-900">
                                    {response.vendor.name}
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="font-semibold text-blue-700">
                                    ₹{response.quotedPrice?.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }) || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Calendar className="h-4 w-4 text-slate-500" />
                                  <span>ETA: {formatDateTime(response.estimatedDelivery)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Clock className="h-4 w-4 text-slate-500" />
                                  <span>{response.status}</span>
                                </div>
                              </div>
                              {!hasApproval && (
                                <button
                                  type="button"
                                  onClick={() => approveQuote(response.id)}
                                  disabled={actionLoading[response.id]}
                                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {actionLoading[response.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <BadgeCheck className="h-4 w-4" />
                                  )}
                                  Approve quotation
                                </button>
                              )}
                            </div>
                            {response.transporterNotes && (
                              <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                                {response.transporterNotes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {hasApproval && request.shipment && (
                        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                          <BadgeCheck className="h-4 w-4" />
                          Shipment #{request.shipment.id} created — awaiting transporter acceptance.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <p className="font-semibold text-slate-900">Need a new quotation?</p>
            <p className="text-sm text-slate-600">
              Head back to the shipment planner, enter your pickup and drop details, and click
              “Request custom quotation” to notify transporters instantly.
            </p>
          </div>
        </div>
      </section>

      <MessageBox message={toast.message} tone={toast.tone} onClose={closeToast} />
    </div>
  );
};

export default QuoteBoard;

