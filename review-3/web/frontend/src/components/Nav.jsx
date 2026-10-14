import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { List, X } from '@phosphor-icons/react'
import Logo from './Logo'
import Button from './Button'
import ThemeToggle from './ThemeToggle'
import { EASE } from '../lib/motion'

const LINKS = [
  { to: '/fleet', label: 'Fleet' },
  { to: '/#process', label: 'Service' },
  { to: '/#branches', label: 'Branches' },
  { to: '/admin', label: 'Concierge desk' },
]

export default function Nav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Hide on scroll down, reveal on scroll up. Driven by Motion's scroll value, not a scroll listener.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setScrolled(y > 24)
    setHidden(y > 240 && y > prev && !open)
  })

  useEffect(() => setOpen(false), [pathname])

  return (
    <motion.header
      className={`nav ${scrolled ? 'nav--scrolled' : ''}`}
      animate={{ y: hidden ? '-100%' : '0%' }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="nav__inner container">
        <Logo />
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav__link ${isActive && !l.to.includes('#') ? 'active' : ''}`}>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav__cta">
          <ThemeToggle />
          <Button to="/reserve" size="sm" cursor="Reserve">Reserve</Button>
        </div>
        <ThemeToggle className="nav__toggle-mobile" />
        <button
          className="nav__burger"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} weight="light" /> : <List size={22} weight="light" />}
        </button>
      </div>
      <span className="nav__rule rule" aria-hidden="true" />
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            className="nav__sheet"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {[...LINKS, { to: '/reserve', label: 'Reserve' }].map((l, i) => (
              <motion.div
                key={l.to}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.5, ease: EASE }}
              >
                <NavLink to={l.to} className="nav__sheet-link">{l.label}</NavLink>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
