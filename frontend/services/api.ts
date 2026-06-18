import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh });
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          original.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Organizations
export const orgsApi = {
  list: (params?: object) => api.get('/organizations', { params }),
  get: (id: number) => api.get(`/organizations/${id}`),
  create: (data: object) => api.post('/organizations', data),
  update: (id: number, data: object) => api.patch(`/organizations/${id}`, data),
  delete: (id: number) => api.delete(`/organizations/${id}`),
};

// Users
export const usersApi = {
  list: (params?: object) => api.get('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.patch(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  changePassword: (id: number, data: object) =>
    api.post(`/users/${id}/change-password`, data),
};

// Sites
export const sitesApi = {
  list: (params?: object) => api.get('/sites', { params }),
  get: (id: number) => api.get(`/sites/${id}`),
  create: (data: object) => api.post('/sites', data),
  update: (id: number, data: object) => api.patch(`/sites/${id}`, data),
  delete: (id: number) => api.delete(`/sites/${id}`),
};

// Roles
export const rolesApi = {
  list: () => api.get('/roles'),
  create: (data: object) => api.post('/roles', data),
  update: (id: number, data: object) => api.patch(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
};

// Permissions
export const permissionsApi = {
  list: () => api.get('/permissions'),
};

// Audit
export const auditApi = {
  list: (params?: object) => api.get('/audit', { params }),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  recentAccess: () => api.get('/dashboard/recent-access'),
};

// Settings
export const settingsApi = {
  list: () => api.get('/settings'),
  update: (key: string, value: string) => api.patch(`/settings/${key}`, { value }),
};
