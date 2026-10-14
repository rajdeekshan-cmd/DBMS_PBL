import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { EASE, EASE_IN_OUT, prefersReducedMotion } from '../lib/motion'
import { useSmooth } from '../lib/smooth'

const SEEN_KEY = 'woxsen:intro-seen'

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage unavailable: intro simply plays again next time */
  }
}

/*
 * The signature draws itself (SVG stroke), a chrome line fills beneath it,
 * then the whole sheet lifts away like a curtain. Plays once per session.
 */
export default function Preloader() {
  const { setReady } = useSmooth()
  const [skip] = useState(alreadySeen)
  const reduce = prefersReducedMotion()
  const [phase, setPhase] = useState(skip ? 'done' : 'loading')

  useEffect(() => {
    if (skip) {
      setReady(true)
      return undefined
    }
    let cancelled = false
    const fonts = document.fonts
      ? Promise.race([document.fonts.load('80px "Pinyon Script"'), new Promise((r) => setTimeout(r, 2500))])
      : Promise.resolve()
    fonts.then(() => {
      if (!cancelled) setPhase('drawing')
    })
    return () => {
      cancelled = true
    }
  }, [skip, setReady])

  useEffect(() => {
    if (phase !== 'drawing') return undefined
    const t = setTimeout(() => setPhase('leaving'), reduce ? 350 : 2300)
    return () => clearTimeout(t)
  }, [phase, reduce])

  useEffect(() => {
    if (phase === 'leaving') {
      markSeen()
      setReady(true)
    }
  }, [phase, setReady])

  const drawing = phase === 'drawing'

  return (
    <AnimatePresence onExitComplete={() => setPhase('done')}>
      {phase !== 'leaving' && phase !== 'done' && (
        <motion.div
          className="preloader"
          role="status"
          aria-label="Loading Woxsen Car Rentals"
          initial={{ y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.3 } } : { y: '-100%', transition: { duration: 1, ease: EASE_IN_OUT } }}
        >
          <div className="preloader__inner">
            <svg className="preloader__mark" viewBox="0 0 520 170" aria-hidden="true">
              <defs>
                <linearGradient id="pre-chrome" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--ink-2)' }} />
                  <stop offset="0.45" style={{ stopColor: 'var(--ink)' }} />
                  <stop offset="0.7" style={{ stopColor: 'var(--muted)' }} />
                  <stop offset="1" style={{ stopColor: 'var(--ink)' }} />
                </linearGradient>
              </defs>
              <motion.text
                x="50%"
                y="118"
                textAnchor="middle"
                className="preloader__word"
                stroke="url(#pre-chrome)"
                strokeWidth="1.1"
                initial={{ strokeDashoffset: 900, fillOpacity: 0 }}
                animate={
                  drawing
                    ? { strokeDashoffset: 0, fillOpacity: 1, transition: {
                        strokeDashoffset: { duration: reduce ? 0 : 1.7, ease: EASE },
                        fillOpacity: { duration: reduce ? 0.2 : 0.6, delay: reduce ? 0 : 1.3, ease: EASE },
                      } }
                    : {}
                }
                style={{ strokeDasharray: 900, fill: 'var(--ink)' }}
              >
                Woxsen
              </motion.text>
            </svg>
            <div className="preloader__track" aria-hidden="true">
              <motion.span
                className="preloader__fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: drawing ? 1 : 0.18 }}
                transition={{ duration: drawing ? (reduce ? 0.2 : 2) : 0.8, ease: EASE }}
              />
            </div>
            <p className="preloader__caption">Car Rentals</p>
          </div>
          <span className="preloader__edge" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
