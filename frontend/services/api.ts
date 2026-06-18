import axios from 'axios';

const api = axios.create({
  baseURL: '/nexaops/api/v1',
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
          const res = await axios.post('/nexaops/api/v1/auth/refresh', { refresh_token: refresh });
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          original.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(original);
        } catch (refreshError) {
          console.error('Session refresh failed:', refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login?reason=session_expired';
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
  mfaVerify: (mfa_token: string, code: string) =>
    api.post('/auth/mfa/verify', { mfa_token, code }),
  mfaSetup: () => api.get('/auth/mfa/setup'),
  mfaEnable: (code: string) => api.post('/auth/mfa/enable', { code }),
  mfaDisable: (opts: { code?: string; password?: string }) =>
    api.post('/auth/mfa/disable', opts),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }),
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
  meta: () => api.get('/audit/meta'),
};

// Dashboard
export const dashboardApi = {
  stats:           () => api.get('/dashboard/stats'),
  recentAccess:    () => api.get('/dashboard/recent-access'),
  discoveryHealth: () => api.get('/dashboard/discovery-health'),
};


// Assets (CMDB)
export const assetsApi = {
  list: (params?: object) => api.get('/assets', { params }),
  get: (id: number) => api.get(`/assets/${id}`),
  create: (data: object) => api.post('/assets', data),
  update: (id: number, data: object) => api.patch(`/assets/${id}`, data),
  delete: (id: number) => api.delete(`/assets/${id}`),
  stats: () => api.get('/assets/stats'),
  types: () => api.get('/assets/types'),
  manufacturers: () => api.get('/assets/manufacturers'),
  tags: () => api.get('/assets/tags'),
  history: (id: number) => api.get(`/assets/${id}/history`),
  relationships: (id: number) => api.get(`/assets/${id}/relationships`),
  addRelationship: (id: number, data: object) => api.post(`/assets/${id}/relationships`, data),
  deleteRelationship: (relId: number) => api.delete(`/assets/relationships/${relId}`),
};

// Discovery Engine
export const discoveryApi = {
  list: (params?: object) => api.get('/discovery', { params }),
  start: (data: object) => api.post('/discovery/start', data),
  get: (id: number) => api.get(`/discovery/${id}`),
  results: (id: number, params?: object) => api.get(`/discovery/${id}/results`, { params }),
  delete: (id: number) => api.delete(`/discovery/${id}`),
  stats: () => api.get('/discovery/stats'),
  allRelationships: () => api.get('/discovery/relationships/all'),
};

// Alerts
export const alertsApi = {
  rules: () => api.get('/alerts/rules'),
  createRule: (data: object) => api.post('/alerts/rules', data),
  updateRule: (id: number, data: object) => api.patch(`/alerts/rules/${id}`, data),
  deleteRule: (id: number) => api.delete(`/alerts/rules/${id}`),
  toggleRule: (id: number) => api.post(`/alerts/rules/${id}/toggle`),
  testRule: (id: number) => api.post(`/alerts/rules/${id}/test`),
  events: (params?: object) => api.get('/alerts/events', { params }),
  stats: () => api.get('/alerts/stats'),
};

// Discovery Schedules
export const schedulesApi = {
  list: () => api.get('/schedules'),
  create: (data: object) => api.post('/schedules', data),
  update: (id: number, data: object) => api.patch(`/schedules/${id}`, data),
  delete: (id: number) => api.delete(`/schedules/${id}`),
  toggle: (id: number) => api.post(`/schedules/${id}/toggle`),
  runNow: (id: number) => api.post(`/schedules/${id}/run-now`),
  status: () => api.get('/schedules/status'),
};

// ── Phase 3: Monitoring ───────────────────────────────────────────────────────
export const monitoringApi = {
  listTargets: (params?: object) => api.get('/monitoring/targets', { params }),
  getTarget: (id: number) => api.get(`/monitoring/targets/${id}`),
  createTarget: (body: object) => api.post('/monitoring/targets', body),
  updateTarget: (id: number, body: object) => api.patch(`/monitoring/targets/${id}`, body),
  deleteTarget: (id: number) => api.delete(`/monitoring/targets/${id}`),
  pollTarget: (id: number) => api.post(`/monitoring/targets/${id}/poll`),
  getMetrics: (id: number, params?: object) => api.get(`/monitoring/targets/${id}/metrics`, { params }),
  metricsSummary: () => api.get('/monitoring/metrics/summary'),
  listAlertRules: () => api.get('/monitoring/alert-rules'),
  createAlertRule: (body: object) => api.post('/monitoring/alert-rules', body),
  updateAlertRule: (id: number, body: object) => api.patch(`/monitoring/alert-rules/${id}`, body),
  deleteAlertRule: (id: number) => api.delete(`/monitoring/alert-rules/${id}`),
  listOids: (params?: object) => api.get('/monitoring/oids', { params }),
};

export const printersApi = {
  list: (params?: object) => api.get('/printers', { params }),
  get: (id: number) => api.get(`/printers/${id}`),
  getSupplies: (id: number, params?: object) => api.get(`/printers/${id}/supplies`, { params }),
  criticalSupplies: () => api.get('/printers/summary/critical'),
};

export const eventsApi = {
  list: (params?: object) => api.get('/events', { params }),
  stats: () => api.get('/events/stats'),
  acknowledge: (id: number) => api.patch(`/events/${id}/acknowledge`),
  resolve: (id: number) => api.patch(`/events/${id}/resolve`),
  listIncidents: (params?: object) => api.get('/events/incidents', { params }),
  createIncident: (body: object) => api.post('/events/incidents', body),
  acknowledgeIncident: (id: number) => api.patch(`/events/incidents/${id}/acknowledge`),
  resolveIncident: (id: number) => api.patch(`/events/incidents/${id}/resolve`),
};

export const nocApi = {
  overview: () => api.get('/noc/overview'),
  timeline: (hours?: number) => api.get('/noc/timeline', { params: { hours } }),
  healthMap: () => api.get('/noc/health-map'),
};

export const settingsApi = {
  list: () => api.get('/settings'),
  update: (key: string, value: string) => api.patch(`/settings/${key}`, { value }),
  testEmail: (to_email: string) => api.post('/settings/test-email', { to_email }),
};

export const notificationApi = {
  listChannels: () => api.get('/notification/channels'),
  createChannel: (body: object) => api.post('/notification/channels', body),
  updateChannel: (id: number, body: object) => api.patch(`/notification/channels/${id}`, body),
  deleteChannel: (id: number) => api.delete(`/notification/channels/${id}`),
  testChannel: (id: number) => api.post(`/notification/channels/${id}/test`),
};

// ── Phase 4: Endpoint Management & RMM ────────────────────────────────────────

export const agentsApi = {
  list: (params?: object) => api.get('/agents', { params }).then(r => r.data),
  get: (id: number) => api.get(`/agents/${id}`).then(r => r.data),
  getStats: () => api.get('/agents/stats').then(r => r.data),
  enroll: (body: object) => api.post('/agents/enroll', body).then(r => r.data),
  checkin: (body: object) => api.post('/agents/checkin', body).then(r => r.data),
  delete: (id: number) => api.delete(`/agents/${id}`),
};

export const endpointsApi = {
  list: (params?: object) => api.get('/endpoints', { params }).then(r => r.data),
  get: (id: number) => api.get(`/endpoints/${id}`).then(r => r.data),
  getStats: () => api.get('/endpoints/stats').then(r => r.data),
  update: (id: number, body: object) => api.patch(`/endpoints/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/endpoints/${id}`),
};

export const softwareApi = {
  list: (params?: object) => api.get('/software-inventory', { params }).then(r => r.data),
  summary: () => api.get('/software-inventory/summary').then(r => r.data),
  byEndpoint: (endpointId: number) => api.get('/software-inventory', { params: { endpoint_id: endpointId } }).then(r => r.data),
};

export const licensesApi = {
  list: (params?: object) => api.get('/licenses', { params }).then(r => r.data),
  get: (id: number) => api.get(`/licenses/${id}`).then(r => r.data),
  create: (body: object) => api.post('/licenses', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/licenses/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/licenses/${id}`),
  summary: () => api.get('/licenses/summary').then(r => r.data),
  assign: (id: number, body: object) => api.post(`/licenses/${id}/assign`, body).then(r => r.data),
  listAssignments: (id: number) => api.get(`/licenses/${id}/assignments`).then(r => r.data),
};

export const vulnsApi = {
  list: (params?: object) => api.get('/vulnerabilities', { params }).then(r => r.data),
  create: (body: object) => api.post('/vulnerabilities', body).then(r => r.data),
  listEndpointVulns: (params?: object) => api.get('/vulnerabilities/endpoint-vulns', { params }).then(r => r.data),
  summary: () => api.get('/vulnerabilities/summary').then(r => r.data),
  updateEndpointVuln: (id: number, body: object) => api.patch(`/vulnerabilities/endpoint-vulns/${id}`, body).then(r => r.data),
};

export const complianceApi = {
  listPolicies: () => api.get('/compliance/policies').then(r => r.data),
  createPolicy: (body: object) => api.post('/compliance/policies', body).then(r => r.data),
  updatePolicy: (id: number, body: object) => api.patch(`/compliance/policies/${id}`, body).then(r => r.data),
  deletePolicy: (id: number) => api.delete(`/compliance/policies/${id}`),
  listChecks: (params?: object) => api.get('/compliance/checks', { params }).then(r => r.data),
  summary: () => api.get('/compliance/summary').then(r => r.data),
};

export const remoteActionsApi = {
  list: (params?: object) => api.get('/remote-actions', { params }).then(r => r.data),
  get: (id: number) => api.get(`/remote-actions/${id}`).then(r => r.data),
  create: (body: object) => api.post('/remote-actions', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/remote-actions/${id}`, body).then(r => r.data),
  cancel: (id: number) => api.post(`/remote-actions/${id}/cancel`).then(r => r.data),
  delete: (id: number) => api.delete(`/remote-actions/${id}`),
};

export const patchesApi = {
  list: (params?: object) => api.get('/patches', { params }).then(r => r.data),
  listEndpointPatches: (params?: object) => api.get('/patches/endpoint-patches', { params }).then(r => r.data),
  summary: () => api.get('/patches/summary').then(r => r.data),
};

export const jobsApi = {
  list: (params?: object) => api.get('/jobs', { params }).then(r => r.data),
  get: (id: number) => api.get(`/jobs/${id}`).then(r => r.data),
  create: (body: object) => api.post('/jobs', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/jobs/${id}`, body).then(r => r.data),
  cancel: (id: number) => api.post(`/jobs/${id}/cancel`).then(r => r.data),
  delete: (id: number) => api.delete(`/jobs/${id}`),
};

export const policiesApi = {
  list: (params?: object) => api.get('/policies', { params }).then(r => r.data),
  get: (id: number) => api.get(`/policies/${id}`).then(r => r.data),
  create: (body: object) => api.post('/policies', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/policies/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/policies/${id}`),
  listChecks: (policyId: number, params?: object) => api.get(`/policies/${policyId}/checks`, { params }).then(r => r.data),
};

// ── Phase 5: ITSM Enterprise ─────────────────────────────────────────────────

export const ticketsApi = {
  list: (params?: object) => api.get('/tickets', { params }).then(r => r.data),
  get: (id: number) => api.get(`/tickets/${id}`).then(r => r.data),
  create: (body: object) => api.post('/tickets', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/tickets/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/tickets/${id}`),
  getStats: () => api.get('/tickets/stats').then(r => r.data),
  listComments: (id: number) => api.get(`/tickets/${id}/comments`).then(r => r.data),
  addComment: (id: number, body: object) => api.post(`/tickets/${id}/comments`, body).then(r => r.data),
  listActivities: (id: number) => api.get(`/tickets/${id}/activities`).then(r => r.data),
};

export const problemsApi = {
  list: (params?: object) => api.get('/problems', { params }).then(r => r.data),
  get: (id: number) => api.get(`/problems/${id}`).then(r => r.data),
  create: (body: object) => api.post('/problems', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/problems/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/problems/${id}`),
  getStats: () => api.get('/problems/stats').then(r => r.data),
  listComments: (id: number) => api.get(`/problems/${id}/comments`).then(r => r.data),
  addComment: (id: number, body: object) => api.post(`/problems/${id}/comments`, body).then(r => r.data),
  linkTicket: (id: number, body: object) => api.post(`/problems/${id}/link-ticket`, body).then(r => r.data),
  listLinkedTickets: (id: number) => api.get(`/problems/${id}/linked-tickets`).then(r => r.data),
};

export const changesApi = {
  list: (params?: object) => api.get('/changes', { params }).then(r => r.data),
  get: (id: number) => api.get(`/changes/${id}`).then(r => r.data),
  create: (body: object) => api.post('/changes', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/changes/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/changes/${id}`),
  getStats: () => api.get('/changes/stats').then(r => r.data),
  getCalendar: (params?: object) => api.get('/changes/calendar', { params }).then(r => r.data),
  listApprovals: (id: number) => api.get(`/changes/${id}/approvals`).then(r => r.data),
  decideApproval: (changeId: number, approvalId: number, body: object) =>
    api.post(`/changes/${changeId}/approvals/${approvalId}/decide`, body).then(r => r.data),
  listComments: (id: number) => api.get(`/changes/${id}/comments`).then(r => r.data),
  addComment: (id: number, body: object) => api.post(`/changes/${id}/comments`, body).then(r => r.data),
};

export const serviceCatalogApi = {
  list: (params?: object) => api.get('/service-catalog', { params }).then(r => r.data),
  get: (id: number) => api.get(`/service-catalog/${id}`).then(r => r.data),
  create: (body: object) => api.post('/service-catalog', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/service-catalog/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/service-catalog/${id}`),
  listCategories: () => api.get('/service-catalog/categories').then(r => r.data),
  request: (id: number, body: object) => api.post(`/service-catalog/${id}/request`, body).then(r => r.data),
};

export const knowledgeBaseApi = {
  list: (params?: object) => api.get('/knowledge-base', { params }).then(r => r.data),
  get: (id: number) => api.get(`/knowledge-base/${id}`).then(r => r.data),
  create: (body: object) => api.post('/knowledge-base', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/knowledge-base/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/knowledge-base/${id}`),
  listCategories: () => api.get('/knowledge-base/categories').then(r => r.data),
  popular: () => api.get('/knowledge-base/popular').then(r => r.data),
  voteHelpful: (id: number) => api.post(`/knowledge-base/${id}/vote`, { helpful: true }).then(r => r.data),
};

export const slaApi = {
  listPolicies: () => api.get('/sla/policies').then(r => r.data),
  getPolicy: (id: number) => api.get(`/sla/policies/${id}`).then(r => r.data),
  createPolicy: (body: object) => api.post('/sla/policies', body).then(r => r.data),
  updatePolicy: (id: number, body: object) => api.patch(`/sla/policies/${id}`, body).then(r => r.data),
  deletePolicy: (id: number) => api.delete(`/sla/policies/${id}`),
  getDashboard: () => api.get('/sla/dashboard').then(r => r.data),
};

export const workflowsApi = {
  list: (params?: object) => api.get('/workflows', { params }).then(r => r.data),
  get: (id: number) => api.get(`/workflows/${id}`).then(r => r.data),
  create: (body: object) => api.post('/workflows', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/workflows/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/workflows/${id}`),
  execute: (id: number, body: object) => api.post(`/workflows/${id}/execute`, body).then(r => r.data),
  listExecutions: (id: number, params?: object) => api.get(`/workflows/${id}/executions`, { params }).then(r => r.data),
};

export const automationsApi = {
  list: (params?: object) => api.get('/automations', { params }).then(r => r.data),
  get: (id: number) => api.get(`/automations/${id}`).then(r => r.data),
  create: (body: object) => api.post('/automations', body).then(r => r.data),
  update: (id: number, body: object) => api.patch(`/automations/${id}`, body).then(r => r.data),
  delete: (id: number) => api.delete(`/automations/${id}`),
  toggle: (id: number) => api.post(`/automations/${id}/toggle`).then(r => r.data),
  trigger: (id: number, body: object) => api.post(`/automations/${id}/trigger`, body).then(r => r.data),
};
