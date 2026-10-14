import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck, Car, ChartBar, Receipt, ArrowUDownLeft, UsersThree } from '@phosphor-icons/react'
import Page from '../../components/Page'
import Vehicles from './Vehicles'
import Customers from './Customers'
import Reservations from './Reservations'
import Returns from './Returns'
import Payments from './Payments'
import Reports from './Reports'
import { EASE } from '../../lib/motion'

const SECTIONS = [
  { path: 'reservations', label: 'Reservations', icon: CalendarCheck, el: Reservations },
  { path: 'returns', label: 'Returns', icon: ArrowUDownLeft, el: Returns },
  { path: 'payments', label: 'Payments', icon: Receipt, el: Payments },
  { path: 'vehicles', label: 'Vehicles', icon: Car, el: Vehicles },
  { path: 'customers', label: 'Clients', icon: UsersThree, el: Customers },
  { path: 'reports', label: 'Reports', icon: ChartBar, el: Reports },
]

export default function AdminLayout() {
  const location = useLocation()
  const sub = location.pathname.split('/')[2] || ''

  // On the mobile scroll rail, keep the active section in view.
  useEffect(() => {
    const el = document.querySelector('.admin__link.active')
    const rail = el?.parentElement
    if (el && rail && rail.scrollWidth > rail.clientWidth) {
      rail.scrollTo({ left: el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
    }
  }, [sub])
  return (
    <Page className="admin" title="Concierge desk">
      <div className="admin__shell container">
        <aside className="admin__rail">
          <p className="admin__brand">Concierge desk</p>
          <nav aria-label="Desk sections" className="admin__nav">
            {SECTIONS.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={`/admin/${path}`} className="admin__link">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="admin-active" className="admin__link-bg" transition={{ duration: 0.55, ease: EASE }} />}
                    <Icon size={18} weight="light" aria-hidden="true" />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="admin__main">
          <AnimatePresence mode="wait">
            <motion.div
              key={sub}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <Routes location={location}>
                <Route index element={<Navigate to="reservations" replace />} />
                {SECTIONS.map(({ path, el: El }) => <Route key={path} path={path} element={<El />} />)}
                <Route path="*" element={<Navigate to="reservations" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Page>
  )
}
