import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './motion'

gsap.registerPlugin(ScrollTrigger)

const SmoothContext = createContext({ lenis: null, ready: false, setReady: () => {} })

/*
 * Lenis drives the native scroll position, GSAP's ticker drives Lenis, and
 * ScrollTrigger updates on every Lenis scroll. Motion's useScroll() reads the
 * same native position, so all three stay in sync. Disabled for reduced motion
 * and touch devices (native momentum scrolling is better there).
 */
export function SmoothProvider({ children }) {
  const [lenis, setLenis] = useState(null)
  const [ready, setReady] = useState(false)
  const lenisRef = useRef(null)

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (prefersReducedMotion() || coarse) return undefined

    const instance = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true })
    lenisRef.current = instance
    setLenis(instance)

    instance.on('scroll', ScrollTrigger.update)
    const tick = (time) => instance.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      instance.destroy()
      lenisRef.current = null
    }
  }, [])

  // Freeze scrolling while the preloader is up.
  useEffect(() => {
    if (!lenis) return
    if (ready) lenis.start()
    else lenis.stop()
  }, [lenis, ready])

  return <SmoothContext.Provider value={{ lenis, ready, setReady }}>{children}</SmoothContext.Provider>
}

export const useSmooth = () => useContext(SmoothContext)

export function scrollToTop(lenis) {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}
