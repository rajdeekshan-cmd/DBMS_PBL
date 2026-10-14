import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ArrowUpRight } from '@phosphor-icons/react'
import VehiclePlate from '../VehiclePlate'
import { Skeleton } from '../Feedback'
import { money, number, titleCase } from '../../lib/format'
import { prefersReducedMotion } from '../../lib/motion'
import { useSmooth } from '../../lib/smooth'

/*
 * Pinned horizontal gallery (desktop): vertical scroll pans the track sideways
 * (section 5.B skeleton: start "top top", pin the wrapper, scrub the track).
 * Each car's plate parallaxes and slowly zooms; name and specs rise in sequence.
 * Below 1024px or with reduced motion it becomes a native scroll-snap row.
 */
export default function FleetGallery({ vehicles, loading, error }) {
  const wrap = useRef(null)
  const track = useRef(null)
  const drag = useRef(null)
  const { lenis } = useSmooth()

  // Desktop: dragging the pinned track scrubs the page scroll 1:1 (the pan maps scroll to x).
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || window.innerWidth < 1024 || prefersReducedMotion()) return
    drag.current = { x: e.clientX, scroll: window.scrollY, moved: false }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const dx = drag.current.x - e.clientX
    if (Math.abs(dx) > 4) drag.current.moved = true
    const target = drag.current.scroll + dx * 1.4
    if (lenis) lenis.scrollTo(target, { duration: 0.6 })
    else window.scrollTo(0, target)
  }
  const endDrag = () => {
    setTimeout(() => { drag.current = null }, 0)
  }
  // Swallow the click that ends a drag so a slide link is not followed by accident.
  const onClickCapture = (e) => {
    if (drag.current?.moved) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  useEffect(() => {
    if (!vehicles?.length || prefersReducedMotion()) return undefined
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const distance = () => track.current.scrollWidth - window.innerWidth
      const pan = gsap.to(track.current, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      })
      gsap.utils.toArray('.gallery__slide', track.current).forEach((slide) => {
        const plate = slide.querySelector('.plate')
        const bits = slide.querySelectorAll('[data-spec]')
        gsap.fromTo(plate, { xPercent: 14, scale: 1.14 }, {
          xPercent: -6, scale: 1, ease: 'none',
          scrollTrigger: { trigger: slide, containerAnimation: pan, start: 'left right', end: 'right left', scrub: true },
        })
        gsap.from(bits, {
          y: 34, opacity: 0, duration: 1, stagger: 0.09, ease: 'expo.out',
          scrollTrigger: { trigger: slide, containerAnimation: pan, start: 'left 70%', toggleActions: 'play none none reverse' },
        })
      })
    })
    mm.add('(max-width: 1023px)', () => {
      gsap.utils.toArray('.gallery__slide', track.current).forEach((slide) => {
        gsap.from(slide.querySelectorAll('[data-spec]'), {
          y: 20, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out',
          scrollTrigger: { trigger: slide, start: 'top 80%' },
        })
      })
    })
    return () => mm.revert()
  }, [vehicles])

  return (
    <section className="gallery" ref={wrap} aria-labelledby="fleet-title">
      <div
        className="gallery__track"
        ref={track}
        data-cursor="Drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="gallery__intro">
          <h2 id="fleet-title" className="h-xl">The <em className="it">Fleet</em></h2>
          <p className="lede">Every car is inspected before it leaves and again when it returns. Rates are per day, fuel and kilometres logged.</p>
          <Link to="/fleet" className="text-link" data-cursor="View">
            Check dates and availability <ArrowUpRight size={16} weight="light" />
          </Link>
        </div>

        {loading && [0, 1].map((i) => (
          <div className="gallery__slide" key={i} aria-hidden="true">
            <Skeleton className="skeleton--plate" />
            <Skeleton style={{ width: '60%', height: 28, marginTop: 24 }} />
          </div>
        ))}

        {error && <p className="gallery__error">{error}</p>}

        {vehicles?.map((v) => (
          <article className="gallery__slide" key={v.vehicle_id}>
            <Link to={`/reserve?vehicle=${v.vehicle_id}`} className="gallery__link" data-cursor="Reserve" aria-label={`Reserve the ${v.model_name}`}>
              <VehiclePlate vehicle={v} size="lg" />
            </Link>
            <div className="gallery__meta">
              <h3 className="gallery__name" data-spec>{v.model_name}</h3>
              <dl className="gallery__specs">
                <div data-spec><dt>Class</dt><dd>{v.category_name}</dd></div>
                <div data-spec><dt>Seats</dt><dd className="num">{v.seating_capacity}</dd></div>
                <div data-spec><dt>Year</dt><dd className="num">{v.manufacture_year}</dd></div>
                <div data-spec><dt>Odometer</dt><dd className="num">{number(v.odometer_km)} km</dd></div>
                <div data-spec><dt>Branch</dt><dd>{v.city}</dd></div>
                <div data-spec><dt>From</dt><dd className="num">{money(v.from_daily_rate)}/day</dd></div>
              </dl>
              {v.status !== 'AVAILABLE' && <p className="gallery__status" data-spec>Currently {titleCase(v.status)}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
