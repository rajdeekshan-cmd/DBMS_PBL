import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { EASE } from '../lib/motion'

/* Inline notice for errors that need reading (trigger messages, validation). */
export function Notice({ tone = 'error', title, children, action }) {
  const Icon = tone === 'error' ? WarningCircle : CheckCircle
  return (
    <motion.div
      className={`notice notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Icon size={20} weight="light" aria-hidden="true" />
      <div className="notice__body">
        {title && <p className="notice__title">{title}</p>}
        <p>{children}</p>
        {action}
      </div>
    </motion.div>
  )
}

export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

/* Toasts: transient confirmations only. */
const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message) => {
    const id = Math.random().toString(36).slice(2)
    setItems((list) => [...list, { id, message }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3800)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <CheckCircle size={18} weight="light" aria-hidden="true" />
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
