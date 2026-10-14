import { motion } from 'motion/react'
import { Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from '../lib/theme'
import { EASE } from '../lib/motion'

/* Black / white switch: a chrome-rimmed track with a knob that slides between sun and moon. */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`theme-toggle ${dark ? 'is-dark' : ''} ${className}`}
      onClick={toggle}
      data-cursor={dark ? 'Light' : 'Dark'}
    >
      <Sun size={14} weight="light" className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true" />
      <Moon size={14} weight="light" className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true" />
      <motion.span
        className="theme-toggle__knob"
        aria-hidden="true"
        initial={false}
        animate={{ x: dark ? 26 : 0 }}
        transition={{ duration: 0.55, ease: EASE }}
      />
    </button>
  )
}
