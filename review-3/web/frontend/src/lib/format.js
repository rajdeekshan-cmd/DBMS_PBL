const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
const int = new Intl.NumberFormat('en-IN')
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dtFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

export const money = (n, exact = false) => (n == null ? '-' : (exact ? inr2 : inr0).format(Number(n)))
export const number = (n) => (n == null ? '-' : int.format(Number(n)))

// API returns naive local datetimes ("2026-09-10T12:00:00"); parse as local time.
export const parseLocal = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null)
export const date = (s) => (s ? dateFmt.format(parseLocal(s)) : '-')
export const dateTime = (s) => (s ? dtFmt.format(parseLocal(s)) : '-')

const pad = (n) => String(n).padStart(2, '0')
// Value for <input type="datetime-local">
export const toInputDT = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export const daysBetween = (a, b) => {
  const ms = parseLocal(b) - parseLocal(a)
  return Math.max(1, Math.ceil(ms / 86400000))
}

export const titleCase = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '')

// Same rule the backend bills with: max(1, whole days between pickup and return + 1).
export const billedDays = (a, b) => Math.max(1, Math.floor((parseLocal(b) - parseLocal(a)) / 86400000) + 1)
