import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react'
import { EASE, prefersReducedMotion, useFinePointer } from '../lib/motion'

/*
 * Black dot + trailing chrome ring. Over anything interactive the ring grows;
 * elements with data-cursor="Label" show that label inside it.
 * Positions live in motion values, never React state. Off on touch / reduced motion.
 */
export default function Cursor() {
  const fine = useFinePointer()
  const enabled = fine && !prefersReducedMotion()
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 260, damping: 32, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 260, damping: 32, mass: 0.6 })
  const [mode, setMode] = useState({ active: false, label: '' })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    document.documentElement.classList.add('has-cursor')

    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
      if (!visible) setVisible(true)
    }
    const over = (e) => {
      const el = e.target.closest('[data-cursor], a, button, [role="button"], select, label[for]')
      if (!el) return setMode((m) => (m.active ? { active: false, label: '' } : m))
      const label = el.getAttribute('data-cursor') || ''
      setMode((m) => (m.active && m.label === label ? m : { active: true, label }))
    }
    const leave = () => setVisible(false)
    const enter = () => setVisible(true)

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    document.documentElement.addEventListener('pointerenter', enter)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('pointerleave', leave)
      document.documentElement.removeEventListener('pointerenter', enter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!enabled) return null
  const big = mode.active && mode.label

  return (
    <div className="cursor" aria-hidden="true" style={{ opacity: visible ? 1 : 0 }}>
      <motion.span className="cursor__dot" style={{ x, y }} animate={{ scale: mode.active ? 0.4 : 1 }} />
      <motion.span
        className="cursor__ring"
        style={{ x: ringX, y: ringY }}
        animate={{ scale: big ? 2.6 : mode.active ? 1.5 : 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <AnimatePresence>
          {big && (
            <motion.span
              key={mode.label}
              className="cursor__label"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 / 2.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {mode.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </div>
  )
}
