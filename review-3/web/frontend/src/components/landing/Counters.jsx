import { motion } from 'motion/react'
import CountUp from '../CountUp'
import { EASE } from '../../lib/motion'

/* Live figures from the database, counted up once when they enter the viewport. */
export default function Counters({ stats }) {
  const items = [
    { key: 'fleet_size', label: 'Cars in the fleet' },
    { key: 'branches', label: 'Branches' },
    { key: 'fleet_km', label: 'Kilometres on the fleet' },
    { key: 'clients', label: 'Registered clients' },
  ]
  return (
    <section className="counters container" aria-label="Woxsen Car Rentals in numbers">
      <span className="rule" aria-hidden="true" />
      <div className="counters__grid">
        {items.map((it, i) => (
          <motion.div
            key={it.key}
            className={`counter counter--${i}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1, delay: i * 0.08, ease: EASE }}
          >
            <p className="counter__value">
              {stats ? <CountUp value={stats[it.key]} duration={it.key === 'fleet_km' ? 2.6 : 1.8} delay={i * 0.1} /> : <span className="num">-</span>}
            </p>
            <p className="counter__label">{it.label}</p>
          </motion.div>
        ))}
      </div>
      <span className="rule" aria-hidden="true" />
    </section>
  )
}
