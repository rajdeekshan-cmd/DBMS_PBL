import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../lib/motion'

const STEPS = [
  { verb: 'Reserve', text: 'Choose a car and your dates. Availability is checked live and your licence is verified before anything is confirmed.' },
  { verb: 'Collect', text: 'Meet us at the branch. We walk the car with you, record fuel and odometer, then hand over the keys.' },
  { verb: 'Return', text: 'Bring it back to the same branch. A return inspection and an itemised invoice, with every line explained.' },
]

/*
 * A vertical chrome line draws itself with scroll; each moment rises in as the
 * line reaches it. The line is the narrative: one journey, three stops.
 */
export default function Process() {
  const root = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const ctx = gsap.context(() => {
      gsap.fromTo('.process__line-fill', { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.process__steps', start: 'top 65%', end: 'bottom 65%', scrub: 0.6 },
      })
      gsap.utils.toArray('.process__step').forEach((step) => {
        gsap.from(step.querySelectorAll('.process__node, .process__verb, .process__text'), {
          opacity: 0, x: 40, duration: 1.2, stagger: 0.1, ease: 'expo.out',
          scrollTrigger: { trigger: step, start: 'top 65%', toggleActions: 'play none none reverse' },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="process container" id="process" ref={root} aria-labelledby="process-title">
      <div className="process__head">
        <h2 id="process-title" className="h-xl">Three moments, <em className="it">handled.</em></h2>
      </div>
      <div className="process__steps">
        <span className="process__line" aria-hidden="true"><span className="process__line-fill" /></span>
        <ol className="process__list">
        {STEPS.map((s) => (
          <li className="process__step" key={s.verb}>
            <span className="process__node" aria-hidden="true" />
            <h3 className="process__verb">{s.verb}</h3>
            <p className="process__text">{s.text}</p>
          </li>
        ))}
        </ol>
      </div>
    </section>
  )
}
