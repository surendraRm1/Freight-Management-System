import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import axios from 'axios';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_BASE = `${API_ROOT}/api/v1`;
const TOKEN_STORAGE_KEY = 'authToken';

const getTokenStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const readToken = () => {
  const storage = getTokenStorage();
  return storage ? storage.getItem(TOKEN_STORAGE_KEY) : null;
};

const persistToken = (value) => {
  const storage = getTokenStorage();
  if (!storage) return;
  if (value) {
    storage.setItem(TOKEN_STORAGE_KEY, value);
  } else {
    storage.removeItem(TOKEN_STORAGE_KEY);
  }
};

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const rolePermissionMap = {
  SUPER_ADMIN: ['CALCULATE_SHIPMENT'],
  COMPANY_ADMIN: ['CALCULATE_SHIPMENT'],
  OPERATIONS: ['CALCULATE_SHIPMENT'],
  USER: ['CALCULATE_SHIPMENT'],
  FINANCE_APPROVER: [],
  TRANSPORTER: [],
  AGENT: [],
};

const enrichUser = (user) => {
  if (!user) return null;
  const permissions = rolePermissionMap[user.role] || [];
  return { ...user, permissions };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(token));
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE,
    });

    instance.interceptors.request.use((config) => {
      const storedToken = readToken();
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
      return config;
    });

    return instance;
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/profile');
    setUser(enrichUser(response.data.user));
    setIsAuthenticated(true);
    return response.data.user;
  }, [api]);

  const verifyUser = useCallback(async () => {
    const storedToken = readToken();
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      setToken(storedToken);
      await refreshUser();
    } catch (error) {
      console.error('Session verification failed:', error);
      persistToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    verifyUser();
  }, [verifyUser]);

  const login = async (email, password, options = {}) => {
    try {
      const payload = { email, password };
      if (options.twoFactorCode) {
        payload.twoFactorCode = options.twoFactorCode;
        payload.challengeId = options.challengeId;
      }
      const response = await api.post('/auth/login', payload);
      if (response.status === 202 || response.data?.twoFactorRequired) {
        return {
          success: false,
          twoFactorRequired: true,
          challengeId: response.data.challengeId,
          expiresAt: response.data.expiresAt,
          message: response.data.message,
        };
      }

      const { token: authToken, user: loggedInUser } = response.data;

      persistToken(authToken);
      setUser(enrichUser(loggedInUser));
      setToken(authToken);
      setIsAuthenticated(true);

      let redirectPath = '/dashboard';
      if (loggedInUser.role === 'SUPER_ADMIN') {
        redirectPath = '/super-admin/companies';
      } else if (loggedInUser.role === 'COMPANY_ADMIN') {
        redirectPath = '/dashboard';
      } else if (loggedInUser.role === 'FINANCE_APPROVER') {
        redirectPath = '/finance';
      } else if (loggedInUser.role === 'TRANSPORTER') {
        redirectPath = '/transporter';
      }

      return { success: true, user: loggedInUser, redirectPath };
    } catch (error) {
      const responseData = error.response?.data || {};
      if (responseData.twoFactorRequired) {
        return {
          success: false,
          twoFactorRequired: true,
          challengeId: responseData.challengeId,
          expiresAt: responseData.expiresAt,
          message: responseData.message,
        };
      }

      return {
        success: false,
        error: responseData.error || 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout request failed', error);
    } finally {
      persistToken(null);
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    api,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;

