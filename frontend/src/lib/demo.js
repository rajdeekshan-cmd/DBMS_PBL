/*
 * Read-only demo data for static hosting (GitHub Pages), enabled by VITE_DEMO=1.
 * Serves a snapshot of the real sample database exported from the live API
 * (public/demo/*.json). Availability uses the same rules as the SQL: no
 * MAINTENANCE/RETIRED cars, no overlapping BOOKED/ISSUED reservation, and no
 * car still out on an overdue rental. Every write is refused with a clear message.
 */
import { ApiError } from './api'

const base = `${import.meta.env.BASE_URL}demo/`
const cache = new Map()

function load(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`${base}${name}.json`).then((r) => {
        if (!r.ok) throw new ApiError('Demo data could not be loaded.', r.status, 'http')
        return r.json()
      }),
    )
  }
  return cache.get(name)
}

const ts = (s) => new Date(String(s).replace(' ', 'T')).getTime()

async function availability(p) {
  const [vehicles, reservations] = await Promise.all([load('vehicles'), load('reservations')])
  const from = p.pickup ? ts(p.pickup) : null
  const to = p.return ? ts(p.return) : null
  if ((from === null) !== (to === null)) throw new ApiError('Provide both pickup and return, or neither.', 400, 'validation')
  if (from !== null && to <= from) throw new ApiError('Return must be after pickup.', 400, 'validation')
  const now = Date.now()
  return vehicles
    .filter((v) => !['MAINTENANCE', 'RETIRED'].includes(v.status))
    .filter((v) => !p.category_id || String(v.category_id) === String(p.category_id))
    .filter((v) => !p.branch_id || String(v.branch_id) === String(p.branch_id))
    .filter((v) => {
      if (from === null) return true
      return !reservations.some((r) => {
        if (r.vehicle_id !== v.vehicle_id) return false
        const active = r.status === 'BOOKED' || r.status === 'ISSUED'
        const overlap = from < ts(r.planned_return) && to > ts(r.planned_pickup)
        const overdue = r.status === 'ISSUED' && ts(r.planned_return) < now
        return (active && overlap) || overdue
      })
    })
    .sort((a, b) => b.from_daily_rate - a.from_daily_rate || a.model_name.localeCompare(b.model_name))
}

export async function demoRequest(path, { method = 'GET', params = {} } = {}) {
  if (method !== 'GET') {
    throw new ApiError('Demo mode: this site is a read-only preview. Run the backend (see the README) to book, issue, return or edit.', 403, 'demo')
  }
  const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  const parts = path.split('/').filter(Boolean)
  const [head, arg] = parts

  if (head === 'availability') return availability(p)
  if (head === 'reports') {
    if (!arg) {
      return [
        ['fleet-availability', 'Fleet Availability'], ['overdue-rentals', 'Overdue Rentals'],
        ['vehicle-utilization', 'Vehicle Utilization'], ['damage-report', 'Damage Report'],
        ['branch-revenue', 'Branch Revenue'], ['customer-history', 'Customer History'],
      ].map(([key, title]) => ({ key, title }))
    }
    const data = await load(`report-${arg}`)
    if (arg === 'customer-history' && p.customer_id) {
      return { ...data, rows: data.rows.filter((r) => String(r.customer_id) === String(p.customer_id)) }
    }
    return data
  }
  if (head === 'rate-plans') {
    const rows = await load('rate-plans')
    return p.category_id ? rows.filter((r) => String(r.category_id) === String(p.category_id)) : rows
  }
  if (head === 'reservations' && !arg) {
    const rows = await load('reservations')
    if (!p.status) return rows
    const set = p.status.split(',')
    return rows.filter((r) => set.includes(r.status))
  }
  if (head === 'rentals') {
    const rows = await load('rentals')
    return p.open ? rows.filter((r) => !r.actual_return_dt && r.actual_pickup_dt) : rows
  }
  if (head === 'invoices') {
    const rows = await load('invoices')
    if (arg) {
      const row = rows.find((r) => String(r.invoice_id) === arg)
      if (!row) throw new ApiError('Invoice not found.', 404, 'not_found')
      return { ...row, payments: [] }
    }
    return p.unpaid ? rows.filter((r) => r.status !== 'PAID') : rows
  }
  if (['stats', 'categories', 'branches', 'vehicles', 'customers'].includes(head) && !arg) return load(head)
  if (head === 'vehicles' && arg) {
    const row = (await load('vehicles')).find((v) => String(v.vehicle_id) === arg)
    if (!row) throw new ApiError('Vehicle not found.', 404, 'not_found')
    return row
  }
  throw new ApiError('Not available in the demo.', 404, 'not_found')
}
