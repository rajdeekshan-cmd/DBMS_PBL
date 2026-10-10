import { useRef } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { prefersReducedMotion, useFinePointer } from '../lib/motion'

/* 3D tilt that follows the cursor, with a chrome glare sliding across the surface. */
export default function TiltCard({ children, className = '', max = 7, ...rest }) {
  const ref = useRef(null)
  const fine = useFinePointer()
  const active = fine && !prefersReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 150, damping: 20 })
  const sy = useSpring(py, { stiffness: 150, damping: 20 })
  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max, -max])
  const gx = useTransform(sx, [0, 1], ['-20%', '120%'])
  const glare = useMotionTemplate`linear-gradient(105deg, transparent 0%, rgba(255,255,255,0) calc(${gx} - 25%), rgba(255,255,255,0.55) ${gx}, rgba(255,255,255,0) calc(${gx} + 25%), transparent 100%)`

  const onMove = (e) => {
    if (!active) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const reset = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      className={`tilt ${className}`}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={active ? { rotateX, rotateY, transformPerspective: 1100 } : undefined}
      {...rest}
    >
      {children}
      {active && <motion.span className="tilt__glare" style={{ backgroundImage: glare }} aria-hidden="true" />}
    </motion.div>
  )
}
