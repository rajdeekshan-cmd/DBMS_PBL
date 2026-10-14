import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Field } from '../Field'
import Button from '../Button'
import { EASE } from '../../lib/motion'
import { toInputDT } from '../../lib/format'

/* Closing moment: pick dates here and land on the fleet page already filtered. */
export default function Closing() {
  const navigate = useNavigate()
  const [pickup, setPickup] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return toInputDT(d)
  })
  const [ret, setRet] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(10, 0, 0, 0)
    return toInputDT(d)
  })
  const invalid = ret <= pickup

  const submit = (e) => {
    e.preventDefault()
    if (!invalid) navigate(`/fleet?pickup=${encodeURIComponent(pickup)}&return=${encodeURIComponent(ret)}`)
  }

  return (
    <section className="closing container" aria-labelledby="closing-title">
      <motion.div
        className="closing__inner"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        <p className="script closing__script" aria-hidden="true">whenever you are ready</p>
        <h2 id="closing-title" className="h-xl">When would you like to leave?</h2>
        <form className="closing__form" onSubmit={submit}>
          <Field label="Pickup" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} required />
          <Field label="Return" type="datetime-local" value={ret} onChange={(e) => setRet(e.target.value)} required
            error={invalid ? 'Return must be after pickup.' : undefined} />
          <Button type="submit" variant="chrome" cursor="View" disabled={invalid}>Check availability</Button>
        </form>
      </motion.div>
    </section>
  )
}
