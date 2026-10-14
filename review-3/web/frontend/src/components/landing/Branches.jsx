import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Phone } from '@phosphor-icons/react'
import { branchImage } from '../../config/media'
import { EASE, useFinePointer } from '../../lib/motion'

/*
 * City names in large outlined type. On hover a circular mask expands from the
 * cursor side to reveal the branch (photo slot, or an ink panel with details).
 * Touch: details are always visible under each name.
 */
export default function Branches({ branches, vehiclesByBranch }) {
  const [active, setActive] = useState(null)
  const fine = useFinePointer()

  return (
    <section className="branches container" id="branches" aria-labelledby="branches-title">
      <h2 id="branches-title" className="h-lg branches__title">Collect in <em className="it">three cities</em></h2>
      <ul className="branches__list">
        {branches.map((b) => {
          const img = branchImage(b.city)
          const isOn = active === b.branch_id
          return (
            <li
              key={b.branch_id}
              className={`branch ${isOn ? 'is-active' : ''}`}
              onPointerEnter={() => fine && setActive(b.branch_id)}
              onPointerLeave={() => fine && setActive(null)}
            >
              <Link to={`/fleet?branch=${b.branch_id}`} className="branch__link" data-cursor="View" onFocus={() => setActive(b.branch_id)} onBlur={() => setActive(null)}>
                <span className="branch__city outline-type">{b.city}</span>
                <span className="branch__city branch__city--fill" aria-hidden="true">{b.city}</span>
                <span className="branch__count num">{vehiclesByBranch[b.branch_id] || 0} cars</span>
              </Link>
              <div className="branch__inline">
                <span>{b.branch_name}, {b.address}</span>
                <a href={`tel:${b.phone}`}>{b.phone}</a>
              </div>
              <AnimatePresence>
                {isOn && fine && (
                  <motion.div
                    className="branch__reveal"
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.8, ease: EASE }}
                    aria-hidden="true"
                  >
                    {img ? <img src={img} alt="" loading="lazy" /> : (
                      <div className="branch__panel">
                        <p className="branch__panel-name">{b.branch_name}</p>
                        <p>{b.address}</p>
                        <p className="branch__panel-tel"><Phone size={14} weight="light" /> {b.phone}</p>
                        <p className="branch__panel-go">See cars here <ArrowUpRight size={14} weight="light" /></p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
