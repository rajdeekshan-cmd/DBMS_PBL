import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { prefersReducedMotion, useFinePointer } from '../lib/motion'

/* Gently pulls its child toward the cursor. Motion values only, no re-renders. */
export default function Magnetic({ children, strength = 0.28, className, as = 'span' }) {
  const ref = useRef(null)
  const fine = useFinePointer()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 180, damping: 22, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 180, damping: 22, mass: 0.5 })
  const active = fine && !prefersReducedMotion()
  const Comp = motion[as]

  const onMove = (e) => {
    if (!active || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <Comp
      ref={ref}
      className={['magnetic', className].filter(Boolean).join(' ')}
      style={active ? { x: sx, y: sy } : undefined}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </Comp>
  )
}
