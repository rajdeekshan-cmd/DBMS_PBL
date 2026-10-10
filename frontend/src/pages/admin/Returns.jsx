import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { ArrowUDownLeft, Plus, Trash } from '@phosphor-icons/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/StatusChip'
import Button from '../../components/Button'
import InvoiceBreakdown from '../../components/admin/InvoiceBreakdown'
import { Drawer } from '../../components/Overlay'
import { Field } from '../../components/Field'
import { Notice, useToast } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { dateTime, money, number, toInputDT } from '../../lib/format'

export default function Returns() {
  const { data, error, loading, reload } = useLoad(() => api.rentals(true))
  const [rental, setRental] = useState(null)
  const [form, setForm] = useState({})
  const [damages, setDamages] = useState([])
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const toast = useToast()

  const open = (r) => {
    setFormError(null)
    setResult(null)
    setRental(r)
    setDamages([])
    setForm({ return_odometer: '', fuel_level_pct: '', inspected_by: '', condition_notes: '', actual_return_dt: toInputDT(new Date()) })
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setDamage = (i, k) => (e) => setDamages(damages.map((d, j) => (j === i ? { ...d, [k]: e.target.value } : d)))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const res = await api.returnVehicle(rental.rental_id, { ...form, damages: damages.filter((d) => d.description || d.repair_cost) })
      setResult(res)
      toast(`${rental.model_name} returned. Invoice #${res.invoice_id}`)
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const close = () => { setRental(null); setResult(null) }

  return (
    <>
      <SectionHead title="Returns" />
      {error && <Notice title="Could not load rentals">{error}</Notice>}
      <DataTable
        caption="Cars currently out"
        loading={loading}
        rows={data}
        rowKey={(r) => r.rental_id}
        empty="Every car is home. Nothing to return."
        columns={[
          { key: 'rental_id', label: 'Rental', className: 'num strong', render: (r) => `#${r.rental_id}` },
          { key: 'customer_name', label: 'Client' },
          { key: 'model_name', label: 'Car', render: (r) => <>{r.model_name} <span className="muted num">{r.registration_no}</span></> },
          { key: 'actual_pickup_dt', label: 'Collected', render: (r) => dateTime(r.actual_pickup_dt) },
          { key: 'planned_return', label: 'Due back', render: (r) => dateTime(r.planned_return) },
          { key: 'pickup_odometer', label: 'Pickup km', align: 'right', render: (r) => number(r.pickup_odometer) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.is_overdue ? 'OVERDUE' : r.status} /> },
          { key: 'actions', label: 'Actions', align: 'right', render: (r) => (
            <button className="text-btn" onClick={() => open(r)}><ArrowUDownLeft size={16} weight="light" /> Return</button>
          ) },
        ]}
      />

      <Drawer open={!!rental} onClose={close} title={result ? `Rental #${rental?.rental_id} closed` : `Return rental #${rental?.rental_id ?? ''}`} width="620px">
        {result ? (
          <>
            <InvoiceBreakdown result={result} />
            <div className="form-grid__actions">
              <Button variant="ghost" magnetic={false} onClick={close}>Close</Button>
              <Button to="/admin/payments" magnetic={false}>Record payment</Button>
            </div>
          </>
        ) : (
          <>
            {rental && (
              <div className="drawer-intro">
                <p className="drawer-intro__title">{rental.model_name} <span className="muted num">{rental.registration_no}</span></p>
                <p className="muted">
                  {rental.customer_name}. Collected {dateTime(rental.actual_pickup_dt)} at {number(rental.pickup_odometer)} km. Due {dateTime(rental.planned_return)}.
                  {' '}{rental.plan_name} plan: {money(rental.daily_rate)} a day, {money(rental.extra_km_rate, true)} per extra km, {money(rental.late_fee_per_hour)} per late hour.
                </p>
              </div>
            )}
            <form className="form-grid" onSubmit={submit}>
              <Field label="Return odometer (km)" type="number" min={rental?.pickup_odometer ?? 0} value={form.return_odometer ?? ''} onChange={set('return_odometer')} required
                hint={rental ? `At least ${number(rental.pickup_odometer)}` : undefined} />
              <Field label="Fuel level (%)" type="number" min={0} max={100} value={form.fuel_level_pct ?? ''} onChange={set('fuel_level_pct')} required hint="0 to 100" />
              <Field label="Return time" type="datetime-local" value={form.actual_return_dt ?? ''} onChange={set('actual_return_dt')} required />
              <Field label="Inspected by" value={form.inspected_by ?? ''} onChange={set('inspected_by')} maxLength={40} />
              <Field as="textarea" rows={2} label="Condition notes" value={form.condition_notes ?? ''} onChange={set('condition_notes')} maxLength={200} className="field--wide" />

              <div className="damages field--wide">
                <p className="damages__head">Damage</p>
                <AnimatePresence initial={false}>
                  {damages.map((d, i) => (
                    <div className="damages__row" key={i}>
                      <Field label="Description" value={d.description} onChange={setDamage(i, 'description')} required maxLength={200} />
                      <Field label="Repair cost" type="number" min={0} step="0.01" value={d.repair_cost} onChange={setDamage(i, 'repair_cost')} required />
                      <button type="button" className="icon-btn" aria-label="Remove damage" onClick={() => setDamages(damages.filter((_, j) => j !== i))}>
                        <Trash size={18} weight="light" />
                      </button>
                    </div>
                  ))}
                </AnimatePresence>
                <button type="button" className="text-btn" onClick={() => setDamages([...damages, { description: '', repair_cost: '' }])}>
                  <Plus size={16} weight="light" /> Add damage
                </button>
              </div>

              <AnimatePresence>{formError && <Notice title="Return not recorded">{formError}</Notice>}</AnimatePresence>
              <div className="form-grid__actions">
                <Button variant="ghost" magnetic={false} onClick={close}>Back</Button>
                <Button type="submit" variant="chrome" magnetic={false} disabled={busy}>{busy ? 'Closing rental' : 'Return and bill'}</Button>
              </div>
            </form>
          </>
        )}
      </Drawer>
    </>
  )
}
