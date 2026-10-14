import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import { BarChart, LineChart } from '../../components/admin/Charts'
import StatusChip from '../../components/StatusChip'
import { Notice, Skeleton } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { EASE } from '../../lib/motion'
import { date, dateTime, money, number } from '../../lib/format'

const KEYS = [
  ['fleet-availability', 'Fleet'],
  ['overdue-rentals', 'Overdue'],
  ['vehicle-utilization', 'Utilisation'],
  ['damage-report', 'Damage'],
  ['branch-revenue', 'Revenue'],
  ['customer-history', 'Client history'],
]

const sumBy = (rows, key, val) => {
  const map = new Map()
  rows.forEach((r) => map.set(r[key], (map.get(r[key]) || 0) + Number(val(r) || 0)))
  return [...map.entries()].map(([k, v]) => ({ k, v }))
}

// What each report charts, in one sentence: the question the chart answers.
const CHARTS = {
  'fleet-availability': { title: 'Cars available now, by branch', type: 'bar', data: (rows) => sumBy(rows, 'branch_name', () => 1), fmt: (n) => Math.round(n) },
  'overdue-rentals': { title: 'Hours overdue, by car', type: 'bar', data: (rows) => rows.map((r) => ({ k: r.registration_no, v: r.hours_overdue })), fmt: (n) => `${Math.round(n)} h` },
  'vehicle-utilization': { title: 'Days rented, by car', type: 'bar', data: (rows) => rows.map((r) => ({ k: r.registration_no, v: r.total_days_rented })), fmt: (n) => Math.round(n) },
  'damage-report': { title: 'Repair cost, by car', type: 'bar', data: (rows) => sumBy(rows, 'registration_no', (r) => r.repair_cost), fmt: (n) => money(n) },
  'branch-revenue': { title: 'Payments collected, by branch', type: 'bar', data: (rows) => rows.map((r) => ({ k: r.branch_name, v: r.total_revenue })), fmt: (n) => money(n) },
  'customer-history': {
    title: 'Invoiced amount per rental, by pickup date', type: 'line',
    data: (rows) => rows.filter((r) => r.total_amount != null)
      .sort((a, b) => String(a.planned_pickup).localeCompare(String(b.planned_pickup)))
      .map((r) => ({ k: date(r.planned_pickup).replace(/ \d{4}$/, ''), v: r.total_amount })),
    fmt: (n) => money(n),
  },
}

const LABELS = {
  vehicle_id: 'Vehicle', registration_no: 'Registration', category_name: 'Class', branch_name: 'Branch', branch_id: 'Branch no.',
  model_name: 'Model', status: 'Status', rental_id: 'Rental', customer_name: 'Client', planned_return: 'Due back',
  actual_return_dt: 'Returned', hours_overdue: 'Hours overdue', total_rentals: 'Rentals', total_days_rented: 'Days rented',
  damage_id: 'Damage', description: 'Description', repair_cost: 'Repair cost', reported_date: 'Reported', total_revenue: 'Revenue',
  customer_id: 'Client no.', full_name: 'Client', planned_pickup: 'Planned pickup', actual_pickup_dt: 'Collected', total_amount: 'Invoiced',
}
const MONEY = new Set(['repair_cost', 'total_revenue', 'total_amount'])
const DATETIME = new Set(['planned_return', 'actual_return_dt', 'planned_pickup', 'actual_pickup_dt'])
const NUMERIC = new Set(['hours_overdue', 'total_rentals', 'total_days_rented', ...MONEY])

function columnsFor(rows) {
  if (!rows?.length) return [{ key: 'none', label: 'Result' }]
  return Object.keys(rows[0]).map((key) => ({
    key,
    label: LABELS[key] || key,
    align: NUMERIC.has(key) ? 'right' : undefined,
    render: (r) => {
      const v = r[key]
      if (v == null) return '-'
      if (key === 'status') return <StatusChip status={v} />
      if (MONEY.has(key)) return money(v, true)
      if (DATETIME.has(key)) return dateTime(v)
      if (key === 'reported_date') return date(v)
      if (NUMERIC.has(key)) return number(v)
      return String(v)
    },
  }))
}

export default function Reports() {
  const [key, setKey] = useState('fleet-availability')
  const { data, error, loading } = useLoad(() => api.report(key), [key])
  const rows = data?.key === key ? data.rows : null
  const chart = CHARTS[key]
  const series = useMemo(() => (rows ? chart.data(rows) : []), [rows, chart])
  const columns = useMemo(() => columnsFor(rows), [rows])
  const Chart = chart.type === 'line' ? LineChart : BarChart

  return (
    <>
      <SectionHead title="Reports" />
      <div className="report-tabs" role="tablist" aria-label="Reports">
        {KEYS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={key === k} className={`report-tab ${key === k ? 'is-on' : ''}`} onClick={() => setKey(k)}>
            <span>{label}</span>
            {key === k && <motion.span layoutId="report-underline" className="report-tab__line" transition={{ duration: 0.55, ease: EASE }} />}
          </button>
        ))}
      </div>
      {error && <Notice title="Report failed">{error}</Notice>}

      <section className="report" aria-live="polite">
        <div className="report__chart">
          <h2 className="report__title">{chart.title}</h2>
          {!rows && loading && <Skeleton className="skeleton--chart" />}
          {rows && series.length > 0 && (
            <Chart key={key} data={series} label={(d) => d.k} value={(d) => Number(d.v)} fmt={chart.fmt} title={chart.title} />
          )}
          {rows && series.length === 0 && <p className="report__empty">No data for this report yet. It fills in as reservations are issued, returned and paid.</p>}
        </div>
        <DataTable key={`t-${key}`} caption={data?.title} loading={loading} rows={rows} rowKey={(r) => JSON.stringify(r)} columns={columns} empty="No rows." />
      </section>
    </>
  )
}
