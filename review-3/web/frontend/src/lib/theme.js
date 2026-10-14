import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { prefersReducedMotion } from './motion'

const KEY = 'woxsen:theme'
const META = { light: '#fbfbf9', dark: '#0c0c0d' }

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function apply(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme])
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage blocked: the choice simply lasts for this page view */
  }
}

/*
 * Light / dark theme. The initial value is set before first paint by the
 * inline script in index.html (saved choice, else light per the brand).
 * Switching reveals the new theme in a circle growing from the toggle,
 * via the View Transitions API; plain instant swap where unsupported or
 * when reduced motion is on.
 */
export function useTheme() {
  const [theme, setTheme] = useState(current)

  // Keep several toggles (desktop nav + mobile sheet) in sync.
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(current()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const toggle = useCallback((event) => {
    const next = current() === 'dark' ? 'light' : 'dark'
    if (!document.startViewTransition || prefersReducedMotion()) {
      apply(next)
      setTheme(next)
      return
    }
    const rect = event?.currentTarget?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 60
    const y = rect ? rect.top + rect.height / 2 : 36
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const t = document.startViewTransition(() => {
      flushSync(() => {
        apply(next)
        setTheme(next)
      })
    })
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    }).catch(() => {})
  }, [])

  return { theme, toggle }
}
