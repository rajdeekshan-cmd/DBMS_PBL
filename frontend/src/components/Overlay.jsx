import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { EASE, SPRING } from '../lib/motion'
import { useSmooth } from '../lib/smooth'

/* Drawer (side) and Modal (centre). Critically-damped spring: no overshoot. */
function Shell({ open, onClose, title, children, kind, width }) {
  const { lenis } = useSmooth()
  const panel = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    lenis?.stop()
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => panel.current?.querySelector('input, select, textarea, button')?.focus(), 80)
    return () => {
      lenis?.start()
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
      prev?.focus?.()
    }
  }, [open, onClose, lenis])

  const panelMotion = kind === 'drawer'
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { opacity: 0, y: 28, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 } }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`overlay overlay--${kind}`}>
          <motion.div
            className="overlay__scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          />
          <motion.section
            ref={panel}
            className={`overlay__panel overlay__panel--${kind}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={width ? { '--panel-w': width } : undefined}
            data-lenis-prevent
            {...panelMotion}
            transition={SPRING}
          >
            <header className="overlay__head">
              <h2 className="overlay__title">{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={20} weight="light" />
              </button>
            </header>
            <div className="overlay__body">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export const Drawer = (p) => <Shell kind="drawer" {...p} />
export const Modal = (p) => <Shell kind="modal" {...p} />
