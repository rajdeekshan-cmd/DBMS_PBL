// Thin fetch wrapper. Errors carry the backend's clean message (`error`) and kind.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const DEMO = import.meta.env.VITE_DEMO === '1'

export class ApiError extends Error {
  constructor(message, status, kind) {
    super(message)
    this.status = status
    this.kind = kind
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  if (DEMO) {
    const { demoRequest } = await import('./demo')
    return demoRequest(path, { method, params, body })
  }
  let url = `${BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString()
    if (qs) url += `?${qs}`
  }
  let res
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('The reservation service is unreachable. Is the backend running on port 5050?', 0, 'network')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data?.kind || 'http')
  }
  return data
}

export const api = {
  stats: () => request('/stats'),
  categories: () => request('/categories'),
  branches: () => request('/branches'),
  ratePlans: (category_id) => request('/rate-plans', { params: { category_id } }),

  vehicles: () => request('/vehicles'),
  vehicle: (id) => request(`/vehicles/${id}`),
  createVehicle: (body) => request('/vehicles', { method: 'POST', body }),
  updateVehicle: (id, body) => request(`/vehicles/${id}`, { method: 'PUT', body }),
  deleteVehicle: (id) => request(`/vehicles/${id}`, { method: 'DELETE' }),

  customers: () => request('/customers'),
  createCustomer: (body) => request('/customers', { method: 'POST', body }),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: 'PUT', body }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  availability: (params) => request('/availability', { params }),
  reservations: (status) => request('/reservations', { params: { status } }),
  createReservation: (body) => request('/reservations', { method: 'POST', body }),
  cancelReservation: (id) => request(`/reservations/${id}/cancel`, { method: 'POST' }),
  issueVehicle: (id, body) => request(`/reservations/${id}/issue`, { method: 'POST', body }),

  rentals: (open) => request('/rentals', { params: { open: open ? 1 : undefined } }),
  returnVehicle: (id, body) => request(`/rentals/${id}/return`, { method: 'POST', body }),

  invoices: (unpaid) => request('/invoices', { params: { unpaid: unpaid ? 1 : undefined } }),
  invoice: (id) => request(`/invoices/${id}`),
  recordPayment: (id, body) => request(`/invoices/${id}/payments`, { method: 'POST', body }),

  reports: () => request('/reports'),
  report: (key, params) => request(`/reports/${key}`, { params }),
}
