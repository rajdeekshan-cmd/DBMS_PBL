import { AnimatePresence, motion } from 'motion/react'
import { EASE } from '../lib/motion'

const LABELS = {
  AVAILABLE: 'Available', RENTED: 'Rented', MAINTENANCE: 'Maintenance', RETIRED: 'Retired',
  BOOKED: 'Booked', ISSUED: 'Issued', CANCELLED: 'Cancelled', COMPLETED: 'Completed',
  ACTIVE: 'Active', RETURNED: 'Returned', OVERDUE: 'Overdue',
  PENDING: 'Pending', PAID: 'Paid', PARTIAL: 'Partial',
}
// Monochrome semantics: outline = idle/ready, solid ink = in use, hatched = needs attention, faded = closed.
const TONE = {
  AVAILABLE: 'outline', BOOKED: 'outline', PENDING: 'outline', ACTIVE: 'solid',
  RENTED: 'solid', ISSUED: 'solid', PARTIAL: 'chrome', PAID: 'chrome',
  OVERDUE: 'alert', MAINTENANCE: 'alert',
  CANCELLED: 'muted', COMPLETED: 'muted', RETURNED: 'muted', RETIRED: 'muted',
}

export default function StatusChip({ status }) {
  const s = String(status || '').toUpperCase()
  return (
    <span className="chip-wrap">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={s}
          className={`chip chip--${TONE[s] || 'outline'}`}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {LABELS[s] || s}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
