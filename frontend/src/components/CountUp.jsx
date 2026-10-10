import { useEffect, useRef } from 'react'
import { animate, useInView } from 'motion/react'
import { EASE, prefersReducedMotion } from '../lib/motion'

/* Counts from 0 to `value` when scrolled into view. Writes textContent directly, no re-renders. */
export default function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration = 2, delay = 0, start }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const go = start ?? inView
  useEffect(() => {
    if (!ref.current) return undefined
    if (value == null) return undefined
    if (prefersReducedMotion()) {
      ref.current.textContent = format(value)
      return undefined
    }
    if (!go) {
      ref.current.textContent = format(0)
      return undefined
    }
    const controls = animate(0, Number(value), {
      duration, delay, ease: EASE,
      onUpdate: (n) => { if (ref.current) ref.current.textContent = format(n) },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, value])
  return <span ref={ref} className="num">{format(0)}</span>
}
