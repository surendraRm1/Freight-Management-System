export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem('authToken');
  } catch {
    return null;
  }
};
