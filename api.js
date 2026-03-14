// src/utils/api.js
// ── All API calls to the backend in one place ─────────────────

const BASE_URL = 'http://localhost:5000/api'

// ── Helper ────────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('rh_token')

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type']
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, config)
  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Something went wrong')
  return data
}

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  signup: (name, email, password) =>
    request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request('/auth/me'),
}

// ── Orders ────────────────────────────────────────────────────
export const ordersAPI = {
  create: (formData) =>
    request('/orders', {
      method: 'POST',
      body: formData, // FormData with files here
    }),

  getAll: () => request('/orders'),

  getStats: () => request('/orders/stats'),

  getOne: (id) => request(`/orders/${id}`),
}

// ── Payment ───────────────────────────────────────────────────
export const paymentAPI = {
  verify: (reference, orderId) =>
    request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ reference, orderId }),
    }),
}
