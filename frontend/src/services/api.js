/**
 * Centralized API Client for PayPilot AI
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Perform an authenticated HTTP request
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('paypilot_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // If unauthorized, clear token and notify auth context
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    localStorage.removeItem('paypilot_token');
    localStorage.removeItem('paypilot_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: `Server returned HTTP status ${response.status}`,
  }));

  if (!response.ok || data.success === false) {
    const errorMsg = data.message || (data.errors ? data.errors.join(', ') : 'An unknown error occurred');
    const err = new Error(errorMsg);
    err.status = response.status;
    err.errors = data.errors || null;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
    getMe: () => request('/auth/me'),
  },

  // Dashboard
  dashboard: {
    getStats: () => request('/dashboard/stats'),
  },

  // Orders
  orders: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/orders${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => request(`/orders/${id}`),
    create: (orderData) => request('/orders', { method: 'POST', body: orderData }),
    update: (id, orderData) => request(`/orders/${id}`, { method: 'PATCH', body: orderData }),
    delete: (id, force = false) => request(`/orders/${id}?force=${force}`, { method: 'DELETE' }),
  },

  // Payments
  payments: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/payments${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => request(`/payments/${id}`),
    createDemo: (paymentData) => request('/payments/demo', { method: 'POST', body: paymentData }),
  },

  // Reconciliation
  reconciliation: {
    trigger: (options = {}) => request('/reconciliation/run', { method: 'POST', body: options }),
    getHistory: () => request('/reconciliation/history'),
  },

  // Incidents
  incidents: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/incidents${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => request(`/incidents/${id}`),
    updateStatus: (id, status, resolutionNote) =>
      request(`/incidents/${id}/status`, {
        method: 'PATCH',
        body: { status, resolutionNote },
      }),
    addNote: (id, note) =>
      request(`/incidents/${id}/notes`, {
        method: 'POST',
        body: { note },
      }),
  },

  // Reports
  reports: {
    getReports: () => request('/reports'),
  },

  // Health
  health: {
    check: () => request('/health'),
  },
};
