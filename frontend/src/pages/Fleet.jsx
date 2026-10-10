import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowRight, CalendarBlank, X } from '@phosphor-icons/react'
import Page from '../components/Page'
import TiltCard from '../components/TiltCard'
import VehiclePlate from '../components/VehiclePlate'
import StatusChip from '../components/StatusChip'
import { Field } from '../components/Field'
import { Notice, Skeleton } from '../components/Feedback'
import Button from '../components/Button'
import { api } from '../lib/api'
import { EASE } from '../lib/motion'
import { billedDays, money, number } from '../lib/format'

function Pills({ label, options, value, onChange, id }) {
  return (
    <div className="pills" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = String(value) === String(o.value)
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            className={`pill ${on ? 'is-on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {on && <motion.span layoutId={`pill-${id}`} className="pill__bg" transition={{ duration: 0.55, ease: EASE }} />}
            <span className="pill__text">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Fleet() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const category = params.get('category') || ''
  const branch = params.get('branch') || ''
  const pickup = params.get('pickup') || ''
  const ret = params.get('return') || ''
  const datesInvalid = pickup && ret && ret <= pickup
  const datesSet = pickup && ret && !datesInvalid

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    Promise.all([api.categories(), api.branches()])
      .then(([c, b]) => { setCategories(c); setBranches(b) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (datesInvalid || (pickup && !ret) || (!pickup && ret)) return undefined
    let live = true
    setLoading(true)
    api.availability({ category_id: category, branch_id: branch, pickup: datesSet ? pickup : '', return: datesSet ? ret : '' })
      .then((rows) => { if (live) { setResults(rows); setError(null) } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [category, branch, pickup, ret, datesSet, datesInvalid])

  const catOptions = useMemo(() => [{ value: '', label: 'All classes' }, ...categories.map((c) => ({ value: c.category_id, label: c.category_name }))], [categories])
  const branchOptions = useMemo(() => [{ value: '', label: 'All cities' }, ...branches.map((b) => ({ value: b.branch_id, label: b.city }))], [branches])
  const days = datesSet ? billedDays(pickup, ret) : null

  const reserveLink = (v) => {
    const q = new URLSearchParams({ vehicle: v.vehicle_id })
    if (datesSet) { q.set('pickup', pickup); q.set('return', ret) }
    return `/reserve?${q}`
  }

  return (
    <Page className="fleet container" title="Fleet and availability">
      <header className="fleet__head">
        <h1 className="h-xl">Fleet and <em className="it">availability</em></h1>
        <p className="lede">Choose dates to see only the cars that are free for the whole of your trip.</p>
      </header>

      <section className="filters" aria-label="Filters">
        <LayoutGroup id="filters">
          <Pills id="cat" label="Vehicle class" options={catOptions} value={category} onChange={(v) => setParam('category', v)} />
          <Pills id="branch" label="City" options={branchOptions} value={branch} onChange={(v) => setParam('branch', v)} />
        </LayoutGroup>
        <div className="filters__dates">
          <CalendarBlank size={20} weight="light" aria-hidden="true" className="filters__cal" />
          <Field label="Pickup" type="datetime-local" value={pickup} onChange={(e) => setParam('pickup', e.target.value)} />
          <Field label="Return" type="datetime-local" value={ret} onChange={(e) => setParam('return', e.target.value)}
            error={datesInvalid ? 'Return must be after pickup.' : undefined} />
          {(pickup || ret) && (
            <button className="text-link filters__clear" onClick={() => { const n = new URLSearchParams(params); n.delete('pickup'); n.delete('return'); setParams(n, { replace: true }) }}>
              <X size={14} weight="light" /> Clear dates
            </button>
          )}
        </div>
      </section>

      <div className="fleet__summary" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${loading}-${results?.length}-${datesSet}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {loading ? 'Checking the fleet' : datesSet
              ? `${results?.length ?? 0} ${results?.length === 1 ? 'car is' : 'cars are'} free for the whole period`
              : `${results?.length ?? 0} cars in service. Add dates to check availability.`}
          </motion.p>
        </AnimatePresence>
      </div>

      {error && <Notice title="Could not load the fleet">{error}</Notice>}

      <div className={`fleet__grid ${loading && results ? 'is-refreshing' : ''}`}>
        {loading && !results && [0, 1, 2, 3].map((i) => (
          <div className="vcard vcard--skeleton" key={i} aria-hidden="true">
            <Skeleton className="skeleton--plate" />
            <Skeleton style={{ width: '55%', height: 26, marginTop: 20 }} />
            <Skeleton style={{ width: '35%', height: 14, marginTop: 12 }} />
          </div>
        ))}

        <AnimatePresence mode="popLayout">
          {results?.map((v, i) => (
            <motion.article
              key={v.vehicle_id}
              layout
              className="vcard-wrap"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.8, delay: i * 0.07, ease: EASE } }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.35, ease: EASE } }}
              transition={{ layout: { duration: 0.7, ease: EASE } }}
            >
              <TiltCard className="vcard">
                <Link to={reserveLink(v)} className="vcard__visual" data-cursor="Reserve" tabIndex={-1} aria-hidden="true">
                  <VehiclePlate vehicle={v} />
                </Link>
                <div className="vcard__body">
                  <div className="vcard__top">
                    <h2 className="vcard__name">{v.model_name}</h2>
                    <StatusChip status={v.status} />
                  </div>
                  <p className="vcard__meta">
                    {v.category_name}, {v.seating_capacity} seats, {v.manufacture_year}. {v.city}, {number(v.odometer_km)} km
                  </p>
                  <div className="vcard__foot">
                    <p className="vcard__price">
                      <span className="num">{money(v.from_daily_rate)}</span>
                      <span className="vcard__per">per day{days ? `, ${money(v.from_daily_rate * days)} for ${days} billed ${days === 1 ? 'day' : 'days'}` : ''}</span>
                    </p>
                    <Link to={reserveLink(v)} className="vcard__cta" data-cursor="Reserve">
                      Reserve <span className="sr-only">the {v.model_name}</span><ArrowRight size={16} weight="light" />
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {!loading && results?.length === 0 && (
        <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: EASE }}>
          <p className="script empty__script">Not this time</p>
          <p className="empty__text">No car matches those filters{datesSet ? ' for the whole period' : ''}. Try another city, class or set of dates.</p>
          <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
        </motion.div>
      )}
    </Page>
  )
}
