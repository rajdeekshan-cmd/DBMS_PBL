import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Page from '../components/Page'
import Hero from '../components/landing/Hero'
import FleetGallery from '../components/landing/FleetGallery'
import Counters from '../components/landing/Counters'
import Process from '../components/landing/Process'
import Marquee from '../components/landing/Marquee'
import Branches from '../components/landing/Branches'
import Closing from '../components/landing/Closing'
import { api } from '../lib/api'
import { useSmooth } from '../lib/smooth'

export default function Landing() {
  const [vehicles, setVehicles] = useState(null)
  const [stats, setStats] = useState(null)
  const [branches, setBranches] = useState([])
  const [error, setError] = useState(null)
  const { lenis, ready } = useSmooth()
  const { hash } = useLocation()

  useEffect(() => {
    Promise.all([api.vehicles(), api.stats(), api.branches()])
      .then(([v, s, b]) => {
        setVehicles(v.filter((x) => x.status !== 'RETIRED').sort((a, z) => z.from_daily_rate - a.from_daily_rate))
        setStats(s)
        setBranches(b)
      })
      .catch((e) => setError(e.message))
  }, [])

  // New content changes page height: recompute every pinned / scrubbed trigger.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [vehicles, branches])

  // Support /#process and /#branches links from the nav.
  useEffect(() => {
    if (!hash || !ready) return undefined
    const t = setTimeout(() => {
      const el = document.querySelector(hash)
      if (!el) return
      if (lenis) lenis.scrollTo(el, { offset: -40, duration: 1.6 })
      else el.scrollIntoView()
    }, 900)
    return () => clearTimeout(t)
  }, [hash, ready, lenis, vehicles])

  const featured = useMemo(
    () => vehicles?.find((v) => v.status === 'AVAILABLE') || vehicles?.[0] || null,
    [vehicles],
  )
  const vehiclesByBranch = useMemo(() => {
    const map = {}
    vehicles?.forEach((v) => { map[v.branch_id] = (map[v.branch_id] || 0) + 1 })
    return map
  }, [vehicles])

  return (
    <Page className="landing" title="Chauffeur-grade cars by the day">
      <Hero featured={featured} />
      <FleetGallery vehicles={vehicles} loading={!vehicles && !error} error={error} />
      <Counters stats={stats} />
      <Process />
      <Marquee />
      <Branches branches={branches} vehiclesByBranch={vehiclesByBranch} />
      <Closing />
    </Page>
  )
}
