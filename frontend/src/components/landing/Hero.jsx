import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowRight } from '@phosphor-icons/react'
import Button from '../Button'
import VehiclePlate from '../VehiclePlate'
import { media } from '../../config/media'
import { useSmooth } from '../../lib/smooth'
import { prefersReducedMotion, GSAP_EASE } from '../../lib/motion'
import { money } from '../../lib/format'

/*
 * Asymmetric split hero. Motion is storytelling: headline lines rise in sequence,
 * the script accent writes itself, the featured car's plate is uncovered, and
 * layers drift at different speeds on scroll (depth). A soft chrome light streak
 * trails the pointer across the hero.
 */
export default function Hero({ featured }) {
  const root = useRef(null)
  const streak = useRef(null)
  const { ready } = useSmooth()

  useEffect(() => {
    if (!ready || !root.current) return undefined
    const reduce = prefersReducedMotion()
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.from('.hero [data-reveal]', { opacity: 0, duration: 0.6, stagger: 0.05 })
        gsap.set('.hero__script-text', { strokeDashoffset: 0, fillOpacity: 1 })
        gsap.set('.hero__cover', { scaleY: 0 })
        return
      }
      const tl = gsap.timeline({ defaults: { ease: GSAP_EASE } })
      tl.from('.hero__line > span', { yPercent: 115, duration: 1.4, stagger: 0.14 }, 0.1)
        .to('.hero__script-text', { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 0.35)
        .to('.hero__script-text', { fillOpacity: 1, duration: 0.8 }, 1.9)
        .to('.hero__cover', { scaleY: 0, duration: 1.5, ease: 'expo.inOut' }, 0.25)
        .from('.hero__visual .plate', { scale: 1.12, duration: 2.2 }, 0.25)
        .from('.hero [data-reveal]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.7)

      // Scroll parallax: three depths.
      const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true }
      gsap.to('.hero__copy', { yPercent: -18, ease: 'none', scrollTrigger: st })
      gsap.to('.hero__visual', { yPercent: 12, ease: 'none', scrollTrigger: st })
      gsap.to('.hero__visual .plate__make', { xPercent: -8, ease: 'none', scrollTrigger: st })
      gsap.to('.hero__visual .plate__model', { xPercent: 10, ease: 'none', scrollTrigger: st })
    }, root)
    return () => ctx.revert()
  }, [ready])

  // Light streak follows the pointer with lag (quickTo writes transforms directly).
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return undefined
    const el = root.current
    const xTo = gsap.quickTo(streak.current, 'x', { duration: 1.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(streak.current, 'y', { duration: 1.6, ease: 'power3.out' })
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      xTo(e.clientX - r.left)
      yTo(e.clientY - r.top)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <section className="hero" ref={root} aria-labelledby="hero-title">
      <span className="hero__streak" ref={streak} aria-hidden="true" />
      <div className="hero__grid container">
        <div className="hero__copy">
          <svg className="hero__script" viewBox="0 0 560 120" aria-hidden="true">
            <text x="4" y="86" className="hero__script-text">Private motoring</text>
          </svg>
          <h1 id="hero-title" className="hero__title display">
            <span className="line-mask hero__line"><span>Arrive the way</span></span>
            <span className="line-mask hero__line"><span>you <em className="it">intended.</em></span></span>
          </h1>
          <p className="hero__sub lede" data-reveal>
            Chauffeur-grade cars reserved by the day across Mumbai, Bengaluru and Pune, prepared and handed over in person.
          </p>
          <div className="hero__ctas" data-reveal>
            <Button to="/reserve" cursor="Reserve" icon={<ArrowRight size={16} weight="light" />}>Reserve</Button>
            <Button to="/fleet" variant="ghost" cursor="View">View the fleet</Button>
          </div>
        </div>

        <div className="hero__visual" data-cursor="View">
          {media.hero ? (
            <img className="hero__img" src={media.hero} alt="" fetchpriority="high" />
          ) : featured ? (
            <VehiclePlate vehicle={featured} size="xl" priority />
          ) : (
            <div className="plate plate--xl"><div className="plate__art"><span className="plate__horizon" /></div></div>
          )}
          <span className="hero__cover" aria-hidden="true" />
          {featured && (
            <p className="hero__caption" data-reveal>
              <span>{featured.model_name}</span>
              <span className="num">from {money(featured.from_daily_rate)} a day</span>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
