import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

const normalizeQueuePayload = ({ entityType, action, payload, entityId }) => ({
  entityType,
  action,
  payload,
  entityId: entityId ?? null,
});

const useSyncMutation = () => {
  const { api } = useAuth();
  const sync = useSync();

  return useCallback(
    async ({ request, queue }) => {
      if (typeof request !== 'function') {
        throw new Error('useSyncMutation requires a request function');
      }

      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (!isOnline && queue) {
        await api.post('/sync/queue', normalizeQueuePayload(queue));
        sync?.refreshQueue?.();
        return { queued: true };
      }

      try {
        const response = await request(api);
        sync?.refreshQueue?.();
        return { response, queued: false };
      } catch (error) {
        if (!queue) {
          throw error;
        }
        // Fallback to enqueueing when API call fails (e.g., network outage)
        await api.post('/sync/queue', normalizeQueuePayload(queue));
        sync?.refreshQueue?.();
        return { queued: true, error };
      }
    },
    [api, sync],
  );
};

export default useSyncMutation;
