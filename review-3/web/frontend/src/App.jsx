import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { SmoothProvider } from './lib/smooth'
import Preloader from './components/Preloader'
import Cursor from './components/Cursor'
import ScrollProgress from './components/ScrollProgress'
import Nav from './components/Nav'
import Footer from './components/Footer'
import { ToastProvider } from './components/Feedback'
import Landing from './pages/Landing'

// Secondary routes load on demand so the landing page stays light.
const loaders = {
  fleet: () => import('./pages/Fleet'),
  reserve: () => import('./pages/Reserve'),
  admin: () => import('./pages/admin/AdminLayout'),
  notFound: () => import('./pages/NotFound'),
}
const Fleet = lazy(loaders.fleet)
const Reserve = lazy(loaders.reserve)
const AdminLayout = lazy(loaders.admin)
const NotFound = lazy(loaders.notFound)

export default function App() {
  const location = useLocation()
  const section = location.pathname.split('/')[1] || 'home'
  const isAdmin = section === 'admin'

  // Warm the other routes once the browser is idle, so transitions never wait on a chunk.
  useEffect(() => {
    const warm = () => Object.values(loaders).forEach((load) => load())
    const id = 'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500)
    return () => ('cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id))
  }, [])

  return (
    <SmoothProvider>
      <ToastProvider>
        <a href="#main" className="skip-link">Skip to content</a>
        <Preloader />
        <Cursor />
        {import.meta.env.VITE_DEMO === '1' && (
          <p className="demo-flag" role="note">
            <span>Live demo: sample data runs in your browser and resets when you close the tab.</span>
            <button type="button" className="demo-flag__reset" onClick={() => import('./lib/demo').then((m) => m.resetDemo())}>
              Reset demo
            </button>
          </p>
        )}
        <ScrollProgress />
        <Nav />
        <Suspense fallback={<div className="route-fallback" aria-busy="true" />}>
          <AnimatePresence mode="wait">
            {/* Admin sub-routes animate inside AdminLayout, so key on the top-level section. */}
            <Routes location={location} key={isAdmin ? 'admin' : location.pathname}>
              <Route path="/" element={<Landing />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/reserve" element={<Reserve />} />
              <Route path="/admin/*" element={<AdminLayout />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        {!isAdmin && <Footer />}
      </ToastProvider>
    </SmoothProvider>
  )
}
