import { useEffect } from 'react'
import { motion } from 'motion/react'
import { EASE_IN_OUT, prefersReducedMotion } from '../lib/motion'
import { scrollToTop, useSmooth } from '../lib/smooth'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/*
 * Route wrapper. On exit a paper curtain with a chrome leading edge rises to
 * cover the page; on enter the same curtain continues upward off-screen.
 * Only transforms are animated. Reduced motion: a plain cross-fade.
 */
export default function Page({ children, className = '', title }) {
  const { lenis } = useSmooth()
  const reduce = prefersReducedMotion()

  useEffect(() => {
    if (title) document.title = `${title} · Woxsen Car Rentals`
    scrollToTop(lenis)
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [lenis, title])

  if (reduce) {
    return (
      <motion.main
        id="main"
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.main>
    )
  }

  return (
    <motion.main id="main" className={className} initial="enter" animate="idle" exit="leave">
      {children}
      <motion.div
        className="curtain"
        aria-hidden="true"
        variants={{
          enter: { y: '0%' },
          idle: { y: '-102%', transition: { duration: 0.95, ease: EASE_IN_OUT, delay: 0.05 } },
          leave: { y: '-102%', transition: { duration: 0 } },
        }}
        style={{ originY: 0 }}
      >
        <span className="curtain__edge curtain__edge--bottom" />
      </motion.div>
      <motion.div
        className="curtain"
        aria-hidden="true"
        variants={{
          enter: { y: '102%' },
          idle: { y: '102%' },
          leave: { y: '0%', transition: { duration: 0.75, ease: EASE_IN_OUT } },
        }}
      >
        <span className="curtain__edge curtain__edge--top" />
        <span className="curtain__word">Woxsen</span>
      </motion.div>
    </motion.main>
  )
}
