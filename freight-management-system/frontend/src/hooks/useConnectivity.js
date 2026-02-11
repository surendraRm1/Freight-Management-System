import { useEffect, useMemo, useRef, useState } from 'react';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PING_INTERVAL = 15000;

const deriveStatus = ({ online, backendReachable }) => {
  if (backendReachable && online) return 'online';
  if (backendReachable && !online) return 'lan';
  if (!backendReachable && online) return 'degraded';
  return 'offline';
};

export const useConnectivity = () => {
  const [state, setState] = useState({
    online: navigator.onLine,
    backendReachable: false,
    lastChecked: null,
  });
  const pingRef = useRef();

  useEffect(() => {
    const updateOnline = () => {
      setState((prev) => ({
        ...prev,
        online: navigator.onLine,
      }));
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    const ping = async () => {
      try {
        const controller = new AbortController();
        pingRef.current = controller;
        const response = await fetch(`${API_ROOT}/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const reachable = response.ok;
        setState((prev) => ({
          ...prev,
          backendReachable: reachable,
          lastChecked: new Date(),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          backendReachable: false,
          lastChecked: new Date(),
        }));
      }
    };
    ping();
    const interval = setInterval(ping, PING_INTERVAL);
    return () => {
      clearInterval(interval);
      if (pingRef.current) {
        pingRef.current.abort();
      }
    };
  }, []);

  return useMemo(() => {
    const status = deriveStatus(state);
    return {
      status,
      lastChecked: state.lastChecked,
      online: state.online,
      backendReachable: state.backendReachable,
    };
  }, [state]);
};

export default useConnectivity;
