import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const SyncContext = createContext(null);

export const useSync = () => useContext(SyncContext);

const DEFAULT_STATE = {
  entries: [],
  errorEntries: [],
  pendingCount: 0,
  errorCount: 0,
  loading: false,
  error: '',
  lastUpdated: null,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  refreshQueue: () => {},
};

export const SyncProvider = ({ children }) => {
  const { api, isAuthenticated } = useAuth();
  const [entries, setEntries] = useState(DEFAULT_STATE.entries);
  const [errorEntries, setErrorEntries] = useState(DEFAULT_STATE.errorEntries);
  const [loading, setLoading] = useState(DEFAULT_STATE.loading);
  const [error, setError] = useState(DEFAULT_STATE.error);
  const [lastUpdated, setLastUpdated] = useState(DEFAULT_STATE.lastUpdated);
  const [isOffline, setIsOffline] = useState(DEFAULT_STATE.isOffline);

  const pendingCount = useMemo(() => entries.length, [entries]);
  const errorCount = useMemo(() => errorEntries.length, [errorEntries]);

  const refreshQueue = useCallback(async () => {
    if (!isAuthenticated) {
      setEntries([]);
      return;
    }

    setLoading(true);
    try {
      const [pendingRes, errorRes] = await Promise.all([
        api.get('/sync/queue', { params: { status: 'PENDING', limit: 50 } }),
        api.get('/sync/queue', { params: { status: 'ERROR', limit: 50 } }),
      ]);
      setEntries(pendingRes.data?.entries || []);
      setErrorEntries(errorRes.data?.entries || []);
      setError('');
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sync queue.');
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const interval = setInterval(() => {
      refreshQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshQueue, isAuthenticated]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = {
    entries,
    errorEntries,
    pendingCount,
    errorCount,
    loading,
    error,
    lastUpdated,
    isOffline,
    refreshQueue,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};
