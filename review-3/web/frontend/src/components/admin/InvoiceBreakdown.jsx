import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import CountUp from '../CountUp'
import { EASE, prefersReducedMotion } from '../../lib/motion'
import { money, number, dateTime } from '../../lib/format'

/*
 * The invoice builds line by line: each charge slides in and counts up in turn,
 * the subtotal and tax follow, and the total arrives last under a chrome sheen.
 */
export default function InvoiceBreakdown({ result }) {
  const inv = result.invoice
  const reduce = prefersReducedMotion()
  const step = reduce ? 0 : 0.55
  const lines = [
    { label: 'Rental', detail: `${inv.days_used} ${inv.days_used === 1 ? 'day' : 'days'} x ${money(inv.daily_rate)}`, value: inv.rental_charges },
    { label: 'Extra kilometres', detail: `${number(inv.km_used)} km driven, ${number(inv.free_km)} included, ${number(inv.extra_km)} x ${money(inv.extra_km_rate, true)}`, value: inv.extra_km_charges },
    { label: 'Late return', detail: `${inv.late_hours} ${inv.late_hours === 1 ? 'hour' : 'hours'} x ${money(inv.late_fee_per_hour)}`, value: inv.late_fee },
    { label: 'Damage', detail: result.damage_ids.length ? `${result.damage_ids.length} recorded` : 'None recorded', value: inv.damage_charges },
  ]
  const totalAt = (lines.length + 2) * step
  const [sheen, setSheen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSheen(true), (totalAt + 1.2) * 1000)
    return () => clearTimeout(t)
  }, [totalAt])

  return (
    <div className="invoice" aria-live="polite">
      <header className="invoice__head">
        <p className="script invoice__script">Invoice</p>
        <p className="invoice__ref num">Invoice no. {result.invoice_id}, rental no. {result.rental_id}</p>
        <p className="invoice__dates">{dateTime(result.actual_pickup_dt)} to {dateTime(result.actual_return_dt)}</p>
      </header>
      <dl className="invoice__lines">
        {lines.map((l, i) => (
          <motion.div key={l.label} className="invoice__line" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * step, duration: 0.6, ease: EASE }}>
            <dt><span>{l.label}</span><small>{l.detail}</small></dt>
            <dd><CountUp value={l.value} start duration={reduce ? 0 : 0.9} delay={i * step} format={(n) => money(n, true)} /></dd>
          </motion.div>
        ))}
        <motion.div className="invoice__line invoice__line--sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: lines.length * step, duration: 0.6 }}>
          <dt><span>Subtotal</span></dt>
          <dd><CountUp value={inv.subtotal} start duration={reduce ? 0 : 0.9} delay={lines.length * step} format={(n) => money(n, true)} /></dd>
        </motion.div>
        <motion.div className="invoice__line" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (lines.length + 1) * step, duration: 0.6, ease: EASE }}>
          <dt><span>Tax</span><small>18% on the subtotal</small></dt>
          <dd><CountUp value={inv.tax_amount} start duration={reduce ? 0 : 0.9} delay={(lines.length + 1) * step} format={(n) => money(n, true)} /></dd>
        </motion.div>
      </dl>
      <motion.div className={`invoice__total ${sheen ? 'is-shining' : ''}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: totalAt, duration: 0.9, ease: EASE }}>
        <span>Total</span>
        <strong><CountUp value={inv.total_amount} start duration={reduce ? 0 : 1.3} delay={totalAt} format={(n) => money(n, true)} /></strong>
        <span className="invoice__sheen" aria-hidden="true" />
      </motion.div>
    </div>
  )
}
