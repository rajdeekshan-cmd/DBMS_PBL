import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/StatusChip'
import Button from '../../components/Button'
import { Drawer, Modal } from '../../components/Overlay'
import { Field } from '../../components/Field'
import { Notice, useToast } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { number } from '../../lib/format'

const EMPTY = { registration_no: '', category_id: '', branch_id: '', model_name: '', manufacture_year: '', odometer_km: '', status: 'AVAILABLE' }
const STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED']

export default function Vehicles() {
  const { data, error, loading, reload } = useLoad(api.vehicles)
  const [refs, setRefs] = useState({ categories: [], branches: [] })
  const [editing, setEditing] = useState(null) // null | 'new' | vehicle
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const toast = useToast()

  useEffect(() => {
    Promise.all([api.categories(), api.branches()]).then(([categories, branches]) => setRefs({ categories, branches })).catch(() => {})
  }, [])

  const open = (v) => {
    setFormError(null)
    setEditing(v || 'new')
    setForm(v ? { registration_no: v.registration_no, category_id: v.category_id, branch_id: v.branch_id, model_name: v.model_name,
      manufacture_year: v.manufacture_year, odometer_km: v.odometer_km, status: v.status } : EMPTY)
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing === 'new') await api.createVehicle(form)
      else await api.updateVehicle(editing.vehicle_id, form)
      toast(editing === 'new' ? 'Vehicle added' : 'Vehicle updated')
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleteError(null)
    try {
      await api.deleteVehicle(deleting.vehicle_id)
      toast(`${deleting.model_name} removed`)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  const isRented = editing && editing !== 'new' && editing.status === 'RENTED'

  return (
    <>
      <SectionHead title="Vehicles">
        <Button size="sm" onClick={() => open(null)} icon={<Plus size={16} weight="light" />} magnetic={false}>Add vehicle</Button>
      </SectionHead>
      {error && <Notice title="Could not load vehicles">{error}</Notice>}
      <DataTable
        caption="Vehicles"
        loading={loading}
        rows={data}
        rowKey={(r) => r.vehicle_id}
        columns={[
          { key: 'registration_no', label: 'Registration', className: 'num strong' },
          { key: 'model_name', label: 'Model' },
          { key: 'category_name', label: 'Class' },
          { key: 'branch_name', label: 'Branch' },
          { key: 'manufacture_year', label: 'Year', align: 'right' },
          { key: 'odometer_km', label: 'Odometer', align: 'right', render: (r) => `${number(r.odometer_km)} km` },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          { key: 'actions', label: 'Actions', align: 'right', render: (r) => (
            <span className="row-actions">
              <button className="icon-btn" onClick={() => open(r)} aria-label={`Edit ${r.model_name}`}><PencilSimple size={18} weight="light" /></button>
              <button className="icon-btn" onClick={() => { setDeleteError(null); setDeleting(r) }} aria-label={`Delete ${r.model_name}`}><Trash size={18} weight="light" /></button>
            </span>
          ) },
        ]}
      />

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add vehicle' : `Edit ${editing?.model_name || ''}`}>
        <form className="form-grid" onSubmit={save}>
          <Field label="Registration number" value={form.registration_no} onChange={set('registration_no')} required maxLength={15} />
          <Field label="Model name" value={form.model_name} onChange={set('model_name')} required maxLength={40} />
          <Field as="select" label="Class" value={form.category_id} onChange={set('category_id')} required>
            <option value="">Choose a class</option>
            {refs.categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </Field>
          <Field as="select" label="Branch" value={form.branch_id} onChange={set('branch_id')} required>
            <option value="">Choose a branch</option>
            {refs.branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}, {b.city}</option>)}
          </Field>
          <Field label="Manufacture year" type="number" min={1990} max={2100} value={form.manufacture_year} onChange={set('manufacture_year')} required />
          <Field label="Odometer (km)" type="number" min={0} value={form.odometer_km} onChange={set('odometer_km')} required />
          <Field as="select" label="Status" value={form.status} onChange={set('status')} disabled={isRented}
            hint={isRented ? 'Out on rental. Status changes when the car is returned.' : 'Rented is set automatically when a car is issued.'}>
            {STATUSES.filter((s) => s !== 'RENTED' || isRented).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </Field>
          <AnimatePresence>{formError && <Notice title="Not saved">{formError}</Notice>}</AnimatePresence>
          <div className="form-grid__actions">
            <Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" magnetic={false} disabled={saving}>{saving ? 'Saving' : 'Save vehicle'}</Button>
          </div>
        </form>
      </Drawer>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete vehicle">
        <p className="modal-text">Delete the {deleting?.model_name} ({deleting?.registration_no})? Vehicles with booking history cannot be deleted; retire them instead.</p>
        <AnimatePresence>{deleteError && <Notice title="Not deleted">{deleteError}</Notice>}</AnimatePresence>
        <div className="form-grid__actions">
          <Button variant="ghost" magnetic={false} onClick={() => setDeleting(null)}>Keep</Button>
          <Button magnetic={false} onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}
