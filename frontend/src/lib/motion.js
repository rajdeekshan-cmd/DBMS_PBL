import { useEffect, useState } from 'react'

// One easing family for the whole site: slow, smooth ease-out. No bounce.
export const EASE = [0.22, 1, 0.36, 1]
export const EASE_IN_OUT = [0.65, 0, 0.35, 1]
export const GSAP_EASE = 'expo.out'
export const SPRING = { type: 'spring', bounce: 0, duration: 0.7 }

const query = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useMediaQuery(q) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mql = window.matchMedia(q)
    const on = () => setMatch(mql.matches)
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [q])
  return match
}

export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)')
