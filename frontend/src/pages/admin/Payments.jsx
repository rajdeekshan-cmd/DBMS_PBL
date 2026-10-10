import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CurrencyInr } from '@phosphor-icons/react'
import SectionHead from '../../components/admin/SectionHead'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/StatusChip'
import Button from '../../components/Button'
import { Modal } from '../../components/Overlay'
import { Field, Segmented } from '../../components/Field'
import { Notice, useToast } from '../../components/Feedback'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { EASE } from '../../lib/motion'
import { date, money } from '../../lib/format'

const MODES = [
  { value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' }, { value: 'NETBANKING', label: 'Net banking' },
]

export default function Payments() {
  const [unpaid, setUnpaid] = useState(true)
  const { data, error, loading, reload } = useLoad(() => api.invoices(unpaid), [unpaid])
  const [paying, setPaying] = useState(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('UPI')
  const [payError, setPayError] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const open = (inv) => {
    setPayError(null)
    setPaying(inv)
    setAmount(String(inv.balance))
    setMode('UPI')
  }

  const pay = async (e) => {
    e.preventDefault()
    setBusy(true)
    setPayError(null)
    try {
      const res = await api.recordPayment(paying.invoice_id, { amount, payment_mode: mode })
      toast(`${money(amount, true)} received. Invoice is ${res.status.toLowerCase()}.`)
      setPaying(null)
      reload()
    } catch (err) {
      setPayError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionHead title="Payments">
        <div className="seg" role="tablist" aria-label="Filter invoices">
          {[[true, 'Outstanding'], [false, 'All invoices']].map(([k, label]) => (
            <button key={label} role="tab" aria-selected={unpaid === k} className={`seg__btn ${unpaid === k ? 'is-on' : ''}`} onClick={() => setUnpaid(k)}>
              {unpaid === k && <motion.span layoutId="pay-filter" className="seg__bg" transition={{ duration: 0.5, ease: EASE }} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </SectionHead>
      {error && <Notice title="Could not load invoices">{error}</Notice>}
      <DataTable
        key={String(unpaid)}
        caption="Invoices"
        loading={loading}
        rows={data}
        rowKey={(r) => r.invoice_id}
        empty={unpaid ? 'Every invoice is settled.' : 'No invoices yet.'}
        columns={[
          { key: 'invoice_id', label: 'Invoice', className: 'num strong', render: (r) => `#${r.invoice_id}` },
          { key: 'customer_name', label: 'Client' },
          { key: 'model_name', label: 'Car' },
          { key: 'branch_name', label: 'Branch' },
          { key: 'invoice_date', label: 'Date', render: (r) => date(r.invoice_date) },
          { key: 'total_amount', label: 'Total', align: 'right', render: (r) => money(r.total_amount, true) },
          { key: 'balance', label: 'Balance', align: 'right', render: (r) => money(r.balance, true) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          { key: 'actions', label: 'Actions', align: 'right', render: (r) => r.balance > 0 ? (
            <button className="text-btn" onClick={() => open(r)}><CurrencyInr size={16} weight="light" /> Record payment</button>
          ) : <span className="muted">Settled</span> },
        ]}
      />

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Payment for invoice #${paying?.invoice_id ?? ''}`}>
        <p className="modal-text">
          {paying?.customer_name}, {paying?.model_name}. Total {money(paying?.total_amount, true)}, paid {money(paying?.amount_paid, true)}, outstanding <strong>{money(paying?.balance, true)}</strong>.
        </p>
        <form className="form-grid form-grid--single" onSubmit={pay}>
          <Field label="Amount (INR)" type="number" min="0.01" step="0.01" max={paying?.balance} value={amount} onChange={(e) => setAmount(e.target.value)} required
            hint="Less than the balance records a partial payment." />
          <Segmented label="Paid by" name="mode" options={MODES} value={mode} onChange={setMode} />
          <AnimatePresence>{payError && <Notice title="Payment not recorded">{payError}</Notice>}</AnimatePresence>
          <div className="form-grid__actions">
            <Button variant="ghost" magnetic={false} onClick={() => setPaying(null)}>Back</Button>
            <Button type="submit" variant="chrome" magnetic={false} disabled={busy}>{busy ? 'Recording' : 'Record payment'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
