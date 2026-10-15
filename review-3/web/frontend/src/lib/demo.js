/*
 * In-browser backend for static hosting (GitHub Pages), enabled by VITE_DEMO=1.
 *
 * It mirrors the Flask API (review-3/web/backend): same endpoints, same response
 * shapes, same validation messages, same trigger rules (overlapping reservation,
 * expired licence, vehicle status on pickup/return) and the same invoice maths
 * (billing.py). Money is computed in whole paise so totals match MySQL DECIMAL.
 *
 * Data starts as a snapshot of the real sample database (public/demo/*.json).
 * Changes live in this browser tab only (sessionStorage) and can be reset.
 */
import { ApiError } from './api'

const KEY = 'woxsen:demo-db:v1'
const base = `${import.meta.env.BASE_URL}demo/`

const VEHICLE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED']
const BLOCKED = ['MAINTENANCE', 'RETIRED']
const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'NETBANKING']
const DAY = 86400000
const HOUR = 3600000

// ------------------------------------------------------------------ helpers
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const ts = (s) => new Date(String(s).replace(' ', 'T')).getTime()
const cents = (x) => Math.round(Number(x) * 100)
const rupees = (c) => c / 100
const err = (message, status = 400, kind = 'validation') => new ApiError(message, status, kind)
const REF_MSG = 'A referenced record (category, branch, customer or plan) does not exist.'
const LINKED_MSG = 'This record is linked to reservations or rentals and cannot be changed or deleted.'

function reqText(data, key, label, max) {
  const v = data[key] == null ? '' : String(data[key]).trim()
  if (!v) throw err(`${label} is required.`)
  if (max && v.length > max) throw err(`${label} must be at most ${max} characters.`)
  return v
}
function optText(data, key, label, max) {
  const v = data[key] == null ? '' : String(data[key]).trim()
  if (max && v.length > max) throw err(`${label} must be at most ${max} characters.`)
  return v || null
}
function int(data, key, label, { required = true, min, max } = {}) {
  const raw = data[key]
  if (raw == null || String(raw).trim() === '') {
    if (required) throw err(`${label} is required.`)
    return null
  }
  const s = String(raw).trim()
  if (!/^[+-]?\d+$/.test(s)) throw err(`${label} must be a whole number.`)
  const n = parseInt(s, 10)
  if (min != null && n < min) throw err(`${label} must be at least ${min}.`)
  if (max != null && n > max) throw err(`${label} must be at most ${max}.`)
  return n
}
function money(data, key, label, { allowZero = true } = {}) {
  const raw = data[key]
  if (raw == null || String(raw).trim() === '') throw err(`${label} is required.`)
  const n = Number(String(raw).trim())
  if (!Number.isFinite(n)) throw err(`${label} must be a number.`)
  if (n < 0 || (!allowZero && n === 0)) throw err(allowZero ? `${label} cannot be negative.` : `${label} must be greater than zero.`)
  return cents(n)
}
function dateTime(v, label, required = true) {
  if (v == null || String(v).trim() === '') {
    if (required) throw err(`${label} is required.`)
    return null
  }
  const s = String(v).trim().replace('Z', '').split('.')[0]
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)) throw err(`${label} must be a date and time (YYYY-MM-DD HH:MM).`)
  const d = new Date(s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) throw err(`${label} must be a date and time (YYYY-MM-DD HH:MM).`)
  return d
}
function dateOnly(v, label) {
  const s = String(v ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s).getTime())) throw err(`${label} must be a date (YYYY-MM-DD).`)
  return s
}
function choice(data, key, label, options, dflt) {
  const v = String(data[key] || dflt || '').trim().toUpperCase()
  if (!options.includes(v)) throw err(`${label} must be one of: ${options.join(', ')}.`)
  return v
}

// -------------------------------------------------------------------- store
let state = null
let loading = null

const get = (name) =>
  fetch(`${base}${name}.json`).then((r) => {
    if (!r.ok) throw err('Demo data could not be loaded.', r.status, 'http')
    return r.json()
  })

async function build() {
  const [vehicles, customers, categories, branches, ratePlans, reservations, rentals, invoices, damageRep] = await Promise.all(
    ['vehicles', 'customers', 'categories', 'branches', 'rate-plans', 'reservations', 'rentals', 'invoices', 'report-damage-report'].map(get),
  )
  const s = {
    categories,
    branches,
    ratePlans: ratePlans.map(({ rate_plan_id, category_id, plan_name, daily_rate, extra_km_rate, late_fee_per_hour }) => ({
      rate_plan_id, category_id, plan_name, daily_rate, extra_km_rate, late_fee_per_hour,
    })),
    vehicles: vehicles.map(({ vehicle_id, registration_no, category_id, branch_id, model_name, manufacture_year, odometer_km, status }) => ({
      vehicle_id, registration_no, category_id, branch_id, model_name, manufacture_year, odometer_km, status,
    })),
    customers: customers.map(({ customer_id, full_name, phone, email, license_number, license_expiry, address }) => ({
      customer_id, full_name, phone, email, license_number, license_expiry, address,
    })),
    reservations: reservations.map(({ reservation_id, customer_id, vehicle_id, branch_id, rate_plan_id, booking_date, planned_pickup, planned_return, status }) => ({
      reservation_id, customer_id, vehicle_id, branch_id, rate_plan_id, booking_date, planned_pickup, planned_return, status,
    })),
    rentals: rentals.map(({ rental_id, reservation_id, actual_pickup_dt, actual_return_dt, pickup_odometer, return_odometer, status }) => ({
      rental_id, reservation_id, actual_pickup_dt, actual_return_dt, pickup_odometer, return_odometer, status,
    })),
    invoices: invoices.map(({ invoice_id, rental_id, invoice_date, rental_charges, extra_km_charges, late_fee, damage_charges, tax_amount, total_amount, status }) => ({
      invoice_id, rental_id, invoice_date, rental_charges, extra_km_charges, late_fee, damage_charges, tax_amount, total_amount, status,
    })),
    payments: invoices
      .filter((i) => i.amount_paid > 0)
      .map((i, n) => ({ payment_id: n + 1, invoice_id: i.invoice_id, payment_date: i.invoice_date, amount: i.amount_paid, payment_mode: 'UPI' })),
    damages: [],
    inspectionSeq: 3,
  }
  // Sample damages: attach each to the rental of the same car and client.
  damageRep.rows.forEach((d) => {
    const veh = s.vehicles.find((v) => v.registration_no === d.registration_no)
    const cust = s.customers.find((c) => c.full_name === d.customer_name)
    const res = s.reservations.find((r) => r.vehicle_id === veh?.vehicle_id && r.customer_id === cust?.customer_id)
    const rental = s.rentals.find((r) => r.reservation_id === res?.reservation_id)
    s.damages.push({ damage_id: d.damage_id, rental_id: rental?.rental_id ?? null, description: d.description, repair_cost: d.repair_cost, reported_date: d.reported_date })
  })
  return s
}

async function init() {
  if (state) return state
  if (!loading) {
    loading = (async () => {
      try {
        const saved = sessionStorage.getItem(KEY)
        if (saved) return JSON.parse(saved)
      } catch {
        /* storage blocked or corrupt: start from the snapshot */
      }
      return build()
    })().then((s) => {
      state = s
      return s
    })
  }
  return loading
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* in-memory only */
  }
}

export function resetDemo() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

const nextId = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1

// -------------------------------------------------------------------- joins
const cat = (s, id) => s.categories.find((c) => c.category_id === id)
const branch = (s, id) => s.branches.find((b) => b.branch_id === id)
const plan = (s, id) => s.ratePlans.find((p) => p.rate_plan_id === id)
const vehicleOf = (s, id) => s.vehicles.find((v) => v.vehicle_id === id)
const customerOf = (s, id) => s.customers.find((c) => c.customer_id === id)
const reservationOf = (s, id) => s.reservations.find((r) => r.reservation_id === id)
const rentalOf = (s, id) => s.rentals.find((r) => r.rental_id === id)
const rentalByRes = (s, id) => s.rentals.find((r) => r.reservation_id === id)
const minRate = (s, categoryId) => {
  const rates = s.ratePlans.filter((p) => p.category_id === categoryId).map((p) => p.daily_rate)
  return rates.length ? Math.min(...rates) : null
}

function vehicleRow(s, v) {
  const c = cat(s, v.category_id)
  const b = branch(s, v.branch_id)
  return {
    vehicle_id: v.vehicle_id, registration_no: v.registration_no, category_id: v.category_id, category_name: c?.category_name,
    seating_capacity: c?.seating_capacity, branch_id: v.branch_id, branch_name: b?.branch_name, city: b?.city,
    model_name: v.model_name, manufacture_year: v.manufacture_year, odometer_km: v.odometer_km, status: v.status,
    from_daily_rate: minRate(s, v.category_id),
  }
}

function customerRow(s, c) {
  return {
    ...c,
    license_expired: c.license_expiry < fmt(new Date()).slice(0, 10) ? 1 : 0,
    reservations: s.reservations.filter((r) => r.customer_id === c.customer_id).length,
  }
}

function reservationRow(s, r) {
  const c = customerOf(s, r.customer_id)
  const v = vehicleOf(s, r.vehicle_id)
  const b = branch(s, r.branch_id)
  const p = plan(s, r.rate_plan_id)
  const rt = rentalByRes(s, r.reservation_id)
  return {
    reservation_id: r.reservation_id, status: r.status, booking_date: r.booking_date, planned_pickup: r.planned_pickup,
    planned_return: r.planned_return, customer_id: r.customer_id, customer_name: c?.full_name, customer_phone: c?.phone,
    vehicle_id: r.vehicle_id, registration_no: v?.registration_no, model_name: v?.model_name, odometer_km: v?.odometer_km,
    vehicle_status: v?.status, branch_id: r.branch_id, branch_name: b?.branch_name, rate_plan_id: r.rate_plan_id,
    plan_name: p?.plan_name, daily_rate: p?.daily_rate, rental_id: rt?.rental_id ?? null, rental_status: rt?.status ?? null,
    actual_pickup_dt: rt?.actual_pickup_dt ?? null, actual_return_dt: rt?.actual_return_dt ?? null,
    pickup_odometer: rt?.pickup_odometer ?? null,
  }
}

function rentalRow(s, rt) {
  const r = reservationOf(s, rt.reservation_id)
  const c = customerOf(s, r.customer_id)
  const v = vehicleOf(s, r.vehicle_id)
  const p = plan(s, r.rate_plan_id)
  const inv = s.invoices.find((i) => i.rental_id === rt.rental_id)
  return {
    rental_id: rt.rental_id, reservation_id: rt.reservation_id, status: rt.status, actual_pickup_dt: rt.actual_pickup_dt,
    actual_return_dt: rt.actual_return_dt, pickup_odometer: rt.pickup_odometer, return_odometer: rt.return_odometer,
    planned_pickup: r.planned_pickup, planned_return: r.planned_return, customer_name: c?.full_name,
    registration_no: v?.registration_no, model_name: v?.model_name, plan_name: p?.plan_name, daily_rate: p?.daily_rate,
    extra_km_rate: p?.extra_km_rate, late_fee_per_hour: p?.late_fee_per_hour,
    is_overdue: !rt.actual_return_dt && ts(r.planned_return) < Date.now() ? 1 : 0,
    invoice_id: inv?.invoice_id ?? null,
  }
}

const paidOf = (s, invoiceId) => s.payments.filter((p) => p.invoice_id === invoiceId).reduce((t, p) => t + cents(p.amount), 0)

function invoiceRow(s, inv) {
  const rt = rentalOf(s, inv.rental_id)
  const r = reservationOf(s, rt.reservation_id)
  const paid = paidOf(s, inv.invoice_id)
  return {
    ...inv,
    amount_paid: rupees(paid),
    balance: rupees(cents(inv.total_amount) - paid),
    customer_name: customerOf(s, r.customer_id)?.full_name,
    registration_no: vehicleOf(s, r.vehicle_id)?.registration_no,
    model_name: vehicleOf(s, r.vehicle_id)?.model_name,
    branch_name: branch(s, r.branch_id)?.branch_name,
  }
}

// ------------------------------------------------------------- availability
function availability(s, p) {
  const category = p.category_id ? int(p, 'category_id', 'Category') : null
  const branchId = p.branch_id ? int(p, 'branch_id', 'Branch') : null
  const pickup = dateTime(p.pickup, 'Pickup', false)
  const ret = dateTime(p.return, 'Return', false)
  if ((pickup === null) !== (ret === null)) throw err('Provide both pickup and return, or neither.')
  if (pickup && ret <= pickup) throw err('Return must be after pickup.')
  const now = Date.now()
  return s.vehicles
    .filter((v) => !BLOCKED.includes(v.status))
    .filter((v) => !category || v.category_id === category)
    .filter((v) => !branchId || v.branch_id === branchId)
    .filter((v) => {
      if (!pickup) return true
      return !s.reservations.some((r) => {
        if (r.vehicle_id !== v.vehicle_id) return false
        const active = r.status === 'BOOKED' || r.status === 'ISSUED'
        const overlap = pickup.getTime() < ts(r.planned_return) && ret.getTime() > ts(r.planned_pickup)
        const overdue = r.status === 'ISSUED' && ts(r.planned_return) < now
        return (active && overlap) || overdue
      })
    })
    .sort((a, b) => cat(s, b.category_id).base_daily_rate - cat(s, a.category_id).base_daily_rate || a.model_name.localeCompare(b.model_name))
    .map((v) => {
      const row = vehicleRow(s, v)
      return {
        vehicle_id: row.vehicle_id, registration_no: row.registration_no, model_name: row.model_name,
        manufacture_year: row.manufacture_year, odometer_km: row.odometer_km, status: row.status, category_id: row.category_id,
        category_name: row.category_name, seating_capacity: row.seating_capacity, branch_id: row.branch_id,
        branch_name: row.branch_name, city: row.city, from_daily_rate: row.from_daily_rate,
      }
    })
}

// ------------------------------------------------------------------ billing
function bill({ pickup, ret, plannedReturn, pickupOdo, returnOdo, daily, extraRate, lateRate, damage }) {
  const days = Math.max(1, Math.floor((ret - pickup) / DAY) + 1)
  const rental = cents(daily) * days
  const kmUsed = returnOdo - pickupOdo
  const free = 200 * days
  const extraKm = Math.max(0, kmUsed - free)
  const extra = extraKm * cents(extraRate)
  const lateHours = ret > plannedReturn ? Math.floor((ret - plannedReturn) / HOUR) : 0
  const late = lateHours * cents(lateRate)
  const subtotal = rental + extra + late + damage
  const tax = Math.floor((subtotal * 18 + 50) / 100) // 18%, rounded half up
  const total = subtotal + tax
  return {
    days_used: days, km_used: kmUsed, free_km: free, extra_km: extraKm, late_hours: lateHours,
    daily_rate: rupees(cents(daily)), extra_km_rate: rupees(cents(extraRate)), late_fee_per_hour: rupees(cents(lateRate)),
    rental_charges: rupees(rental), extra_km_charges: rupees(extra), late_fee: rupees(late), damage_charges: rupees(damage),
    subtotal: rupees(subtotal), tax_amount: rupees(tax), total_amount: rupees(total),
  }
}

// ------------------------------------------------------------------ reports
function report(s, key, params) {
  const now = Date.now()
  if (key === 'fleet-availability') {
    return {
      key, title: 'Fleet Availability',
      rows: s.vehicles.filter((v) => v.status === 'AVAILABLE').map((v) => ({
        vehicle_id: v.vehicle_id, registration_no: v.registration_no, category_name: cat(s, v.category_id)?.category_name,
        branch_name: branch(s, v.branch_id)?.branch_name, model_name: v.model_name, status: v.status,
      })),
    }
  }
  if (key === 'overdue-rentals') {
    return {
      key, title: 'Overdue Rentals',
      rows: s.rentals
        .filter((rt) => !rt.actual_return_dt && ts(reservationOf(s, rt.reservation_id).planned_return) < now)
        .map((rt) => {
          const r = reservationOf(s, rt.reservation_id)
          return {
            rental_id: rt.rental_id, customer_name: customerOf(s, r.customer_id)?.full_name,
            registration_no: vehicleOf(s, r.vehicle_id)?.registration_no, planned_return: r.planned_return,
            actual_return_dt: null, hours_overdue: Math.floor((now - ts(r.planned_return)) / HOUR),
          }
        }),
    }
  }
  if (key === 'vehicle-utilization') {
    const rows = s.vehicles.map((v) => {
      const done = s.rentals.filter((rt) => rt.actual_return_dt && reservationOf(s, rt.reservation_id).vehicle_id === v.vehicle_id)
      const days = done.reduce((t, rt) => {
        const a = new Date(rt.actual_pickup_dt.slice(0, 10)).getTime()
        const b = new Date(rt.actual_return_dt.slice(0, 10)).getTime()
        return t + Math.round((b - a) / DAY)
      }, 0)
      return { vehicle_id: v.vehicle_id, registration_no: v.registration_no, total_rentals: done.length, total_days_rented: days }
    })
    return { key, title: 'Vehicle Utilization', rows: rows.sort((a, b) => b.total_days_rented - a.total_days_rented) }
  }
  if (key === 'damage-report') {
    return {
      key, title: 'Damage Report',
      rows: s.damages.map((d) => {
        const r = reservationOf(s, rentalOf(s, d.rental_id)?.reservation_id)
        return {
          damage_id: d.damage_id, registration_no: vehicleOf(s, r?.vehicle_id)?.registration_no,
          customer_name: customerOf(s, r?.customer_id)?.full_name, description: d.description,
          repair_cost: d.repair_cost, reported_date: d.reported_date,
        }
      }),
    }
  }
  if (key === 'branch-revenue') {
    const totals = new Map()
    s.payments.forEach((p) => {
      const inv = s.invoices.find((i) => i.invoice_id === p.invoice_id)
      const r = reservationOf(s, rentalOf(s, inv.rental_id).reservation_id)
      totals.set(r.branch_id, (totals.get(r.branch_id) || 0) + cents(p.amount))
    })
    const rows = [...totals.entries()]
      .map(([id, c]) => ({ branch_id: id, branch_name: branch(s, id)?.branch_name, total_revenue: rupees(c) }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
    return { key, title: 'Branch Revenue', rows }
  }
  if (key === 'customer-history') {
    let rows = s.reservations
      .map((r) => {
        const rt = rentalByRes(s, r.reservation_id)
        const inv = rt && s.invoices.find((i) => i.rental_id === rt.rental_id)
        const c = customerOf(s, r.customer_id)
        return {
          customer_id: c.customer_id, full_name: c.full_name, registration_no: vehicleOf(s, r.vehicle_id)?.registration_no,
          planned_pickup: r.planned_pickup, planned_return: r.planned_return, actual_pickup_dt: rt?.actual_pickup_dt ?? null,
          actual_return_dt: rt?.actual_return_dt ?? null, total_amount: inv ? inv.total_amount : null,
        }
      })
      .sort((a, b) => a.customer_id - b.customer_id || ts(a.planned_pickup) - ts(b.planned_pickup))
    if (params.customer_id) rows = rows.filter((r) => String(r.customer_id) === String(params.customer_id))
    return { key, title: 'Customer History', rows }
  }
  throw err('Unknown report.', 404, 'not_found')
}

// ---------------------------------------------------------- vehicles, clients
function vehiclePayload(s, data, selfId) {
  const v = {
    registration_no: reqText(data, 'registration_no', 'Registration number', 15).toUpperCase(),
    category_id: int(data, 'category_id', 'Category'),
    branch_id: int(data, 'branch_id', 'Branch'),
    model_name: reqText(data, 'model_name', 'Model name', 40),
    manufacture_year: int(data, 'manufacture_year', 'Manufacture year', { min: 1990, max: 2100 }),
    odometer_km: int(data, 'odometer_km', 'Odometer', { min: 0 }),
    status: choice(data, 'status', 'Status', VEHICLE_STATUSES, 'AVAILABLE'),
  }
  if (s.vehicles.some((x) => x.registration_no === v.registration_no && x.vehicle_id !== selfId)) {
    throw err('A vehicle with this registration number already exists.', 409, 'duplicate')
  }
  if (!cat(s, v.category_id) || !branch(s, v.branch_id)) throw err(REF_MSG, 400, 'reference')
  return v
}

function customerPayload(s, data, selfId) {
  const phone = reqText(data, 'phone', 'Phone', 15)
  if (!/^\d+$/.test(phone)) throw err('Phone must contain digits only.')
  const email = optText(data, 'email', 'Email', 80)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err('Email address is not valid.')
  const c = {
    full_name: reqText(data, 'full_name', 'Full name', 60),
    phone,
    email,
    license_number: reqText(data, 'license_number', 'Licence number', 20).toUpperCase(),
    license_expiry: dateOnly(data.license_expiry, 'Licence expiry'),
    address: optText(data, 'address', 'Address', 120),
  }
  const others = s.customers.filter((x) => x.customer_id !== selfId)
  if (others.some((x) => x.phone === c.phone)) throw err('A customer with this phone number already exists.', 409, 'duplicate')
  if (c.email && others.some((x) => x.email === c.email)) throw err('A customer with this email already exists.', 409, 'duplicate')
  if (others.some((x) => x.license_number === c.license_number)) throw err('A customer with this licence number already exists.', 409, 'duplicate')
  return c
}

// -------------------------------------------------------------- reservations
function createReservation(s, data) {
  const customerId = int(data, 'customer_id', 'Customer')
  const vehicleId = int(data, 'vehicle_id', 'Vehicle')
  const planId = int(data, 'rate_plan_id', 'Rate plan')
  let branchId = int(data, 'branch_id', 'Branch', { required: false })
  const pickup = dateTime(data.planned_pickup, 'Pickup')
  const ret = dateTime(data.planned_return, 'Return')
  if (ret <= pickup) throw err('Return must be after pickup.')

  if (!customerOf(s, customerId)) throw err('Customer not found.', 404, 'not_found')
  const veh = vehicleOf(s, vehicleId)
  if (!veh) throw err('Vehicle not found.', 404, 'not_found')
  if (BLOCKED.includes(veh.status)) throw err(`${veh.model_name} is in ${veh.status.toLowerCase()} and cannot be reserved.`, 409, 'business_rule')
  const p = plan(s, planId)
  if (!p) throw err('Rate plan not found.', 404, 'not_found')
  if (p.category_id !== veh.category_id) throw err("The selected rate plan does not belong to this vehicle's category.", 400, 'business_rule')
  if (branchId == null) branchId = veh.branch_id
  if (!branch(s, branchId)) throw err('Branch not found.', 404, 'not_found')

  // Database triggers, in the same order MySQL fires them.
  const clash = s.reservations.some(
    (r) => r.vehicle_id === vehicleId && (r.status === 'BOOKED' || r.status === 'ISSUED') &&
      pickup.getTime() < ts(r.planned_return) && ret.getTime() > ts(r.planned_pickup),
  )
  if (clash) throw err('Overlapping reservation exists for this vehicle in the selected period', 409, 'business_rule')
  if (customerOf(s, customerId).license_expiry < fmt(pickup).slice(0, 10)) {
    throw err('Customer driving licence is expired before the pickup date', 409, 'business_rule')
  }

  const row = {
    reservation_id: nextId(s.reservations, 'reservation_id'), customer_id: customerId, vehicle_id: vehicleId,
    branch_id: branchId, rate_plan_id: planId, booking_date: fmt(new Date()), planned_pickup: fmt(pickup),
    planned_return: fmt(ret), status: 'BOOKED',
  }
  s.reservations.push(row)
  return reservationRow(s, row)
}

function issueVehicle(s, id, data) {
  const odometer = int(data, 'pickup_odometer', 'Pickup odometer', { min: 0 })
  const fuel = int(data, 'fuel_level_pct', 'Fuel level', { min: 0, max: 100 })
  optText(data, 'inspected_by', 'Inspected by', 40)
  optText(data, 'condition_notes', 'Condition notes', 200)
  const pickup = dateTime(data.actual_pickup_dt, 'Pickup time', false) || new Date()
  void fuel

  const res = reservationOf(s, id)
  if (!res) throw err('Reservation not found.', 404, 'not_found')
  if (res.status !== 'BOOKED') throw err(`Only BOOKED reservations can be issued (this one is ${res.status}).`, 409, 'business_rule')
  const veh = vehicleOf(s, res.vehicle_id)
  if (BLOCKED.includes(veh.status)) throw err(`${veh.model_name} is in ${veh.status.toLowerCase()} and cannot be issued.`, 409, 'business_rule')
  if (veh.status === 'RENTED') throw err(`${veh.model_name} is still out on another rental.`, 409, 'business_rule')
  if (odometer < veh.odometer_km) throw err(`Pickup odometer cannot be below the recorded ${veh.odometer_km} km.`)

  const rental = {
    rental_id: nextId(s.rentals, 'rental_id'), reservation_id: id, actual_pickup_dt: fmt(pickup), actual_return_dt: null,
    pickup_odometer: odometer, return_odometer: null, status: 'ACTIVE',
  }
  s.rentals.push(rental)
  veh.status = 'RENTED' // trg_vehicle_status_on_pickup
  veh.odometer_km = odometer
  res.status = 'ISSUED'
  s.inspectionSeq += 1
  return { rental_id: rental.rental_id, inspection_id: s.inspectionSeq, reservation: reservationRow(s, res) }
}

function returnVehicle(s, rentalId, data) {
  const odometer = int(data, 'return_odometer', 'Return odometer', { min: 0 })
  int(data, 'fuel_level_pct', 'Fuel level', { min: 0, max: 100 })
  optText(data, 'inspected_by', 'Inspected by', 40)
  optText(data, 'condition_notes', 'Condition notes', 200)
  const returnDt = dateTime(data.actual_return_dt, 'Return time', false) || new Date()

  let raw = data.damages
  if (raw == null && (data.damage_description || data.damage_cost)) {
    raw = [{ description: data.damage_description, repair_cost: data.damage_cost }]
  }
  const damages = (raw || []).map((item, i) => {
    if (!item || typeof item !== 'object') throw err('Each damage must be an object.')
    return {
      description: reqText(item, 'description', `Damage ${i + 1} description`, 200),
      cost: money(item, 'repair_cost', `Damage ${i + 1} repair cost`),
    }
  })

  const rt = rentalOf(s, rentalId)
  if (!rt) throw err('Rental not found.', 404, 'not_found')
  if (rt.actual_return_dt || rt.status === 'RETURNED') throw err('This rental has already been returned.', 409, 'business_rule')
  if (!rt.actual_pickup_dt) throw err('This rental was never issued.', 409, 'business_rule')
  if (odometer < rt.pickup_odometer) throw err(`Return odometer cannot be lower than the pickup reading of ${rt.pickup_odometer} km.`)
  if (returnDt.getTime() <= ts(rt.actual_pickup_dt)) throw err('Return time must be after the pickup time.')

  const res = reservationOf(s, rt.reservation_id)
  const p = plan(s, res.rate_plan_id)
  const damageTotal = damages.reduce((t, d) => t + d.cost, 0)
  const result = bill({
    pickup: ts(rt.actual_pickup_dt), ret: returnDt.getTime(), plannedReturn: ts(res.planned_return),
    pickupOdo: rt.pickup_odometer, returnOdo: odometer, daily: p.daily_rate, extraRate: p.extra_km_rate,
    lateRate: p.late_fee_per_hour, damage: damageTotal,
  })

  rt.actual_return_dt = fmt(returnDt)
  rt.return_odometer = odometer
  rt.status = 'RETURNED'
  const veh = vehicleOf(s, res.vehicle_id)
  veh.status = 'AVAILABLE' // trg_vehicle_status_on_pickup
  veh.odometer_km = odometer
  s.inspectionSeq += 1
  const damageIds = damages.map((d) => {
    const row = {
      damage_id: nextId(s.damages, 'damage_id'), rental_id: rentalId, description: d.description,
      repair_cost: rupees(d.cost), reported_date: fmt(new Date()).slice(0, 10),
    }
    s.damages.push(row)
    return row.damage_id
  })
  const invoice = {
    invoice_id: nextId(s.invoices, 'invoice_id'), rental_id: rentalId, invoice_date: fmt(new Date()),
    rental_charges: result.rental_charges, extra_km_charges: result.extra_km_charges, late_fee: result.late_fee,
    damage_charges: result.damage_charges, tax_amount: result.tax_amount, total_amount: result.total_amount, status: 'PENDING',
  }
  s.invoices.push(invoice)
  res.status = 'COMPLETED'
  return {
    rental_id: rentalId, inspection_id: s.inspectionSeq, damage_ids: damageIds, invoice_id: invoice.invoice_id,
    actual_pickup_dt: rt.actual_pickup_dt, actual_return_dt: rt.actual_return_dt, planned_return: res.planned_return,
    invoice: result,
  }
}

function recordPayment(s, invoiceId, data) {
  const amount = money(data, 'amount', 'Amount', { allowZero: false })
  const mode = choice(data, 'payment_mode', 'Payment mode', PAYMENT_MODES)
  const inv = s.invoices.find((i) => i.invoice_id === invoiceId)
  if (!inv) throw err('Invoice not found.', 404, 'not_found')
  const total = cents(inv.total_amount)
  const paid = paidOf(s, invoiceId)
  const balance = total - paid
  if (balance <= 0) throw err('This invoice is already fully paid.', 409, 'business_rule')
  if (amount > balance) throw err(`Amount exceeds the outstanding balance of ${rupees(balance).toFixed(2)}.`)
  const payment = {
    payment_id: nextId(s.payments, 'payment_id'), invoice_id: invoiceId, payment_date: fmt(new Date()),
    amount: rupees(amount), payment_mode: mode,
  }
  s.payments.push(payment)
  inv.status = paid + amount >= total ? 'PAID' : 'PARTIAL'
  return { ...invoiceRow(s, inv), payments: s.payments.filter((p) => p.invoice_id === invoiceId), payment_id: payment.payment_id }
}

// ------------------------------------------------------------------- router
export async function demoRequest(path, { method = 'GET', params = {}, body } = {}) {
  const s = await init()
  const p = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null))
  const [head, a, b] = path.split('/').filter(Boolean)
  const id = a && /^\d+$/.test(a) ? Number(a) : null
  const data = body || {}
  const mutate = (fn) => {
    const out = fn()
    save()
    return out
  }
  const notFound = () => err('Not found.', 404, 'not_found')

  if (method === 'GET') {
    switch (head) {
      case 'stats':
        return {
          fleet_size: s.vehicles.filter((v) => v.status !== 'RETIRED').length,
          branches: s.branches.length,
          fleet_km: s.vehicles.filter((v) => v.status !== 'RETIRED').reduce((t, v) => t + v.odometer_km, 0),
          clients: s.customers.length,
        }
      case 'categories': return [...s.categories].sort((x, y) => x.base_daily_rate - y.base_daily_rate)
      case 'branches': return s.branches
      case 'rate-plans': {
        const cid = p.category_id ? int(p, 'category_id', 'Category') : null
        return s.ratePlans.filter((r) => !cid || r.category_id === cid).map((r) => ({ ...r, category_name: cat(s, r.category_id)?.category_name }))
      }
      case 'vehicles': {
        if (id) {
          const v = vehicleOf(s, id)
          if (!v) throw err('Vehicle not found.', 404, 'not_found')
          return vehicleRow(s, v)
        }
        return s.vehicles.map((v) => vehicleRow(s, v))
      }
      case 'customers': {
        if (id) {
          const c = customerOf(s, id)
          if (!c) throw err('Customer not found.', 404, 'not_found')
          return customerRow(s, c)
        }
        return s.customers.map((c) => customerRow(s, c))
      }
      case 'availability': return availability(s, p)
      case 'reservations': {
        if (id) {
          const r = reservationOf(s, id)
          if (!r) throw err('Reservation not found.', 404, 'not_found')
          return reservationRow(s, r)
        }
        const set = p.status ? p.status.split(',').map((x) => x.trim().toUpperCase()) : null
        return [...s.reservations]
          .filter((r) => !set || set.includes(r.status))
          .sort((x, y) => y.reservation_id - x.reservation_id)
          .map((r) => reservationRow(s, r))
      }
      case 'rentals':
        return [...s.rentals]
          .filter((rt) => !p.open || (!rt.actual_return_dt && rt.actual_pickup_dt))
          .sort((x, y) => y.rental_id - x.rental_id)
          .map((rt) => rentalRow(s, rt))
      case 'invoices': {
        if (id) {
          const inv = s.invoices.find((i) => i.invoice_id === id)
          if (!inv) throw err('Invoice not found.', 404, 'not_found')
          return { ...invoiceRow(s, inv), payments: s.payments.filter((x) => x.invoice_id === id) }
        }
        return [...s.invoices]
          .filter((i) => !p.unpaid || i.status !== 'PAID')
          .sort((x, y) => y.invoice_id - x.invoice_id)
          .map((i) => invoiceRow(s, i))
      }
      case 'reports': {
        if (!a) {
          return [
            ['fleet-availability', 'Fleet Availability', 'vw_fleet_availability'], ['overdue-rentals', 'Overdue Rentals', 'vw_overdue_rentals'],
            ['vehicle-utilization', 'Vehicle Utilization', 'vw_vehicle_utilization'], ['damage-report', 'Damage Report', 'vw_damage_report'],
            ['branch-revenue', 'Branch Revenue', 'vw_branch_revenue'], ['customer-history', 'Customer History', 'vw_customer_history'],
          ].map(([key, title, view]) => ({ key, title, view }))
        }
        return report(s, a, p)
      }
      default: throw notFound()
    }
  }

  if (method === 'POST') {
    if (head === 'vehicles' && !a) {
      return mutate(() => {
        const v = { vehicle_id: nextId(s.vehicles, 'vehicle_id'), ...vehiclePayload(s, data) }
        s.vehicles.push(v)
        return vehicleRow(s, v)
      })
    }
    if (head === 'customers' && !a) {
      return mutate(() => {
        const c = { customer_id: nextId(s.customers, 'customer_id'), ...customerPayload(s, data) }
        s.customers.push(c)
        return customerRow(s, c)
      })
    }
    if (head === 'reservations' && !a) return mutate(() => createReservation(s, data))
    if (head === 'reservations' && id && b === 'cancel') {
      return mutate(() => {
        const r = reservationOf(s, id)
        if (!r) throw err('Reservation not found.', 404, 'not_found')
        if (r.status !== 'BOOKED') throw err(`Only BOOKED reservations can be cancelled (this one is ${r.status}).`, 409, 'business_rule')
        r.status = 'CANCELLED'
        return reservationRow(s, r)
      })
    }
    if (head === 'reservations' && id && b === 'issue') return mutate(() => issueVehicle(s, id, data))
    if (head === 'rentals' && id && b === 'return') return mutate(() => returnVehicle(s, id, data))
    if (head === 'invoices' && id && b === 'payments') return mutate(() => recordPayment(s, id, data))
    throw notFound()
  }

  if (method === 'PUT') {
    if (head === 'vehicles' && id) {
      return mutate(() => {
        const cur = vehicleOf(s, id)
        const next = vehiclePayload(s, data, id)
        if (!cur) throw err('Vehicle not found.', 404, 'not_found')
        if (cur.status === 'RENTED' && next.status !== 'RENTED') throw err('This vehicle is out on rental. Record its return before changing the status.', 409, 'validation')
        if (cur.status !== 'RENTED' && next.status === 'RENTED') throw err('A vehicle becomes RENTED only by issuing it against a reservation.', 409, 'validation')
        Object.assign(cur, next)
        return vehicleRow(s, cur)
      })
    }
    if (head === 'customers' && id) {
      return mutate(() => {
        const cur = customerOf(s, id)
        if (!cur) throw err('Customer not found.', 404, 'not_found')
        Object.assign(cur, customerPayload(s, data, id))
        return customerRow(s, cur)
      })
    }
    throw notFound()
  }

  if (method === 'DELETE') {
    if (head === 'vehicles' && id) {
      return mutate(() => {
        if (!vehicleOf(s, id)) throw err('Vehicle not found.', 404, 'not_found')
        if (s.reservations.some((r) => r.vehicle_id === id)) throw err(LINKED_MSG, 409, 'reference')
        s.vehicles = s.vehicles.filter((v) => v.vehicle_id !== id)
        return { deleted: id }
      })
    }
    if (head === 'customers' && id) {
      return mutate(() => {
        if (!customerOf(s, id)) throw err('Customer not found.', 404, 'not_found')
        if (s.reservations.some((r) => r.customer_id === id)) throw err(LINKED_MSG, 409, 'reference')
        s.customers = s.customers.filter((c) => c.customer_id !== id)
        return { deleted: id }
      })
    }
    throw notFound()
  }

  throw notFound()
}
