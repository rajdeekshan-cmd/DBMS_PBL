import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Key, Plus, XCircle } from '@phosphor-icons/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/StatusChip'
import Button from '../../components/Button'
import { Drawer, Modal } from '../../components/Overlay'
import { Field } from '../../components/Field'
import { Notice, useToast } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { EASE } from '../../lib/motion'
import { dateTime, number, toInputDT } from '../../lib/format'

const FILTERS = [
  { key: 'BOOKED', label: 'Booked' },
  { key: 'ISSUED', label: 'Out now' },
  { key: '', label: 'All' },
]

export default function Reservations() {
  const [filter, setFilter] = useState('BOOKED')
  const { data, error, loading, reload } = useLoad(() => api.reservations(filter), [filter])
  const [issuing, setIssuing] = useState(null)
  const [issueForm, setIssueForm] = useState({})
  const [issueError, setIssueError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [cancelError, setCancelError] = useState(null)
  const toast = useToast()

  const openIssue = (r) => {
    setIssueError(null)
    setIssuing(r)
    setIssueForm({ pickup_odometer: r.odometer_km, fuel_level_pct: 100, inspected_by: '', condition_notes: '', actual_pickup_dt: toInputDT(new Date()) })
  }
  const set = (k) => (e) => setIssueForm({ ...issueForm, [k]: e.target.value })

  const issue = async (e) => {
    e.preventDefault()
    setBusy(true)
    setIssueError(null)
    try {
      const res = await api.issueVehicle(issuing.reservation_id, issueForm)
      toast(`${issuing.model_name} issued. Rental #${res.rental_id}`)
      setIssuing(null)
      reload()
    } catch (err) {
      setIssueError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setCancelError(null)
    try {
      await api.cancelReservation(cancelling.reservation_id)
      toast(`Reservation #${cancelling.reservation_id} cancelled`)
      setCancelling(null)
      reload()
    } catch (err) {
      setCancelError(err.message)
    }
  }

  return (
    <>
      <SectionHead title="Reservations">
        <div className="seg" role="tablist" aria-label="Filter reservations">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className={`seg__btn ${filter === f.key ? 'is-on' : ''}`} onClick={() => setFilter(f.key)}>
              {filter === f.key && <motion.span layoutId="res-filter" className="seg__bg" transition={{ duration: 0.5, ease: EASE }} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <Button size="sm" to="/reserve" icon={<Plus size={16} weight="light" />} magnetic={false}>New reservation</Button>
      </SectionHead>
      {error && <Notice title="Could not load reservations">{error}</Notice>}
      <DataTable
        key={filter}
        caption="Reservations"
        loading={loading}
        rows={data}
        rowKey={(r) => r.reservation_id}
        empty={filter === 'BOOKED' ? 'No reservations are waiting to be issued.' : 'No reservations to show.'}
        columns={[
          { key: 'reservation_id', label: 'No.', className: 'num strong', render: (r) => `#${r.reservation_id}` },
          { key: 'customer_name', label: 'Client' },
          { key: 'model_name', label: 'Car', render: (r) => <>{r.model_name} <span className="muted num">{r.registration_no}</span></> },
          { key: 'branch_name', label: 'Branch' },
          { key: 'planned_pickup', label: 'Pickup', render: (r) => dateTime(r.planned_pickup) },
          { key: 'planned_return', label: 'Return', render: (r) => dateTime(r.planned_return) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.rental_status === 'OVERDUE' && r.status === 'ISSUED' ? 'OVERDUE' : r.status} /> },
          { key: 'actions', label: 'Actions', align: 'right', render: (r) => r.status === 'BOOKED' ? (
            <span className="row-actions">
              <button className="text-btn" onClick={() => openIssue(r)}><Key size={16} weight="light" /> Issue</button>
              <button className="text-btn" onClick={() => { setCancelError(null); setCancelling(r) }}><XCircle size={16} weight="light" /> Cancel</button>
            </span>
          ) : r.rental_id ? <span className="muted">Rental #{r.rental_id}</span> : null },
        ]}
      />

      <Drawer open={!!issuing} onClose={() => setIssuing(null)} title={`Issue reservation #${issuing?.reservation_id ?? ''}`}>
        {issuing && (
          <div className="drawer-intro">
            <p className="drawer-intro__title">{issuing.model_name} <span className="muted num">{issuing.registration_no}</span></p>
            <p className="muted">{issuing.customer_name}. Planned {dateTime(issuing.planned_pickup)}. Recorded odometer {number(issuing.odometer_km)} km.</p>
          </div>
        )}
        <form className="form-grid" onSubmit={issue}>
          <Field label="Pickup odometer (km)" type="number" min={issuing?.odometer_km ?? 0} value={issueForm.pickup_odometer ?? ''} onChange={set('pickup_odometer')} required />
          <Field label="Fuel level (%)" type="number" min={0} max={100} value={issueForm.fuel_level_pct ?? ''} onChange={set('fuel_level_pct')} required hint="0 to 100" />
          <Field label="Pickup time" type="datetime-local" value={issueForm.actual_pickup_dt ?? ''} onChange={set('actual_pickup_dt')} required />
          <Field label="Inspected by" value={issueForm.inspected_by ?? ''} onChange={set('inspected_by')} maxLength={40} />
          <Field as="textarea" rows={3} label="Condition notes" value={issueForm.condition_notes ?? ''} onChange={set('condition_notes')} maxLength={200} className="field--wide" />
          <AnimatePresence>{issueError && <Notice title="Vehicle not issued">{issueError}</Notice>}</AnimatePresence>
          <div className="form-grid__actions">
            <Button variant="ghost" magnetic={false} onClick={() => setIssuing(null)}>Back</Button>
            <Button type="submit" variant="chrome" magnetic={false} disabled={busy}>{busy ? 'Issuing' : 'Issue vehicle'}</Button>
          </div>
        </form>
      </Drawer>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel reservation">
        <p className="modal-text">
          Cancel reservation #{cancelling?.reservation_id} for {cancelling?.customer_name} ({cancelling?.model_name}, {dateTime(cancelling?.planned_pickup)})? The car becomes free for those dates.
        </p>
        <AnimatePresence>{cancelError && <Notice title="Not cancelled">{cancelError}</Notice>}</AnimatePresence>
        <div className="form-grid__actions">
          <Button variant="ghost" magnetic={false} onClick={() => setCancelling(null)}>Keep it</Button>
          <Button magnetic={false} onClick={cancel}>Cancel reservation</Button>
        </div>
      </Modal>
    </>
  )
}
