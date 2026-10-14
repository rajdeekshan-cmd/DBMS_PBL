import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import Button from '../../components/Button'
import { Drawer, Modal } from '../../components/Overlay'
import { Field } from '../../components/Field'
import { Notice, useToast } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { date } from '../../lib/format'

const EMPTY = { full_name: '', phone: '', email: '', license_number: '', license_expiry: '', address: '' }

export default function Customers() {
  const { data, error, loading, reload } = useLoad(api.customers)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [query, setQuery] = useState('')
  const toast = useToast()

  const open = (c) => {
    setFormError(null)
    setEditing(c || 'new')
    setForm(c ? { full_name: c.full_name, phone: c.phone, email: c.email || '', license_number: c.license_number,
      license_expiry: c.license_expiry, address: c.address || '' } : EMPTY)
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editing === 'new') await api.createCustomer(form)
      else await api.updateCustomer(editing.customer_id, form)
      toast(editing === 'new' ? 'Client added' : 'Client updated')
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
      await api.deleteCustomer(deleting.customer_id)
      toast(`${deleting.full_name} removed`)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  const rows = data?.filter((c) => `${c.full_name} ${c.phone} ${c.email} ${c.license_number}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <SectionHead title="Clients">
        <Field label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} className="field--compact" />
        <Button size="sm" onClick={() => open(null)} icon={<Plus size={16} weight="light" />} magnetic={false}>Add client</Button>
      </SectionHead>
      {error && <Notice title="Could not load clients">{error}</Notice>}
      <DataTable
        caption="Clients"
        loading={loading}
        rows={rows}
        rowKey={(r) => r.customer_id}
        empty={query ? 'No client matches that search.' : 'No clients yet.'}
        columns={[
          { key: 'full_name', label: 'Name', className: 'strong' },
          { key: 'phone', label: 'Phone', className: 'num' },
          { key: 'email', label: 'Email' },
          { key: 'license_number', label: 'Licence', className: 'num' },
          { key: 'license_expiry', label: 'Licence expiry', render: (r) => (
            <span className={r.license_expired ? 'expired' : ''}>{date(r.license_expiry)}{r.license_expired ? ', expired' : ''}</span>
          ) },
          { key: 'reservations', label: 'Bookings', align: 'right' },
          { key: 'actions', label: 'Actions', align: 'right', render: (r) => (
            <span className="row-actions">
              <button className="icon-btn" onClick={() => open(r)} aria-label={`Edit ${r.full_name}`}><PencilSimple size={18} weight="light" /></button>
              <button className="icon-btn" onClick={() => { setDeleteError(null); setDeleting(r) }} aria-label={`Delete ${r.full_name}`}><Trash size={18} weight="light" /></button>
            </span>
          ) },
        ]}
      />

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add client' : `Edit ${editing?.full_name || ''}`}>
        <form className="form-grid" onSubmit={save}>
          <Field label="Full name" value={form.full_name} onChange={set('full_name')} required maxLength={60} />
          <Field label="Phone" inputMode="numeric" value={form.phone} onChange={set('phone')} required maxLength={15} hint="Digits only" />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} maxLength={80} />
          <Field label="Licence number" value={form.license_number} onChange={set('license_number')} required maxLength={20} />
          <Field label="Licence expiry" type="date" value={form.license_expiry} onChange={set('license_expiry')} required />
          <Field label="Address" value={form.address} onChange={set('address')} maxLength={120} />
          <AnimatePresence>{formError && <Notice title="Not saved">{formError}</Notice>}</AnimatePresence>
          <div className="form-grid__actions">
            <Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" magnetic={false} disabled={saving}>{saving ? 'Saving' : 'Save client'}</Button>
          </div>
        </form>
      </Drawer>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete client">
        <p className="modal-text">Delete {deleting?.full_name}? Clients with reservations cannot be deleted.</p>
        <AnimatePresence>{deleteError && <Notice title="Not deleted">{deleteError}</Notice>}</AnimatePresence>
        <div className="form-grid__actions">
          <Button variant="ghost" magnetic={false} onClick={() => setDeleting(null)}>Keep</Button>
          <Button magnetic={false} onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}
