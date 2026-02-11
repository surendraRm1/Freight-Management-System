import { useState } from 'react';
import { RefreshCcw, WifiOff, Wifi, X, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';

const formatTimestamp = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '—';
  }
};

const SyncStatusPanel = () => {
  const { entries, errorEntries, pendingCount, errorCount, loading, error, refreshQueue, lastUpdated, isOffline } =
    useSync() || {};
  const { api } = useAuth();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState('');

  if (!pendingCount && !errorCount && !isOffline && !error) {
    return (
      <div className="hidden rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 sm:flex sm:items-center sm:gap-2">
        <Wifi className="h-4 w-4" />
        Synced
      </div>
    );
  }

  const handleUpdateEntry = async (entryId, data) => {
    try {
      setUpdatingId(entryId);
      setActionError('');
      await api.patch(`/sync/queue/${entryId}`, data);
      await refreshQueue();
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || 'Failed to update sync entry.');
    } finally {
      setUpdatingId(null);
    }
  };

  const retryEntry = (entry) =>
    handleUpdateEntry(entry.id, {
      status: 'PENDING',
      errorMessage: null,
    });

  const discardEntry = (entry, note = 'Manually discarded via desktop shell') =>
    handleUpdateEntry(entry.id, {
      status: 'ERROR',
      errorMessage: note,
    });

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:min-w-[240px]">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Sync status</p>
          <button
            type="button"
            onClick={refreshQueue}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4 text-amber-600" />
              <span className="text-amber-600">Offline — queue paused</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-600">Online</span>
            </>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-500">Pending jobs: {pendingCount}</div>
        {errorCount > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errorCount} failed
          </div>
        )}
        {error && <div className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</div>}
        {(pendingCount > 0 || errorCount > 0) && (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
          >
            View queue details
          </button>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Updated {formatTimestamp(lastUpdated)}</p>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Sync queue details</p>
                <p className="text-xs text-slate-500">
                  {pendingCount} pending • {errorCount} failed
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {actionError}
              </div>
            )}

            <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto">
              {entries.length === 0 && errorEntries.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Queue is empty.
                </div>
              )}

              {entries.map((entry) => (
                <div key={`pending-${entry.id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.action}</p>
                      <p className="text-[11px] text-slate-500">{entry.entityType}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase text-blue-600">
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Created {new Date(entry.createdAt).toLocaleString()} • Attempts {entry.attempts}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={updatingId === entry.id}
                      onClick={() => discardEntry(entry)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard
                    </button>
                  </div>
                </div>
              ))}

              {errorEntries.map((entry) => (
                <div key={`error-${entry.id}`} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-rose-900">{entry.action}</p>
                      <p className="text-[11px] text-rose-600">{entry.entityType}</p>
                    </div>
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase text-rose-700">
                      Failed
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-700">
                    {entry.errorMessage || 'Worker reported an error.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={updatingId === entry.id}
                      onClick={() => retryEntry(entry)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:border-emerald-400 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === entry.id}
                      onClick={() => discardEntry(entry, 'Manually dismissed')}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:border-slate-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SyncStatusPanel;
