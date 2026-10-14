import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'
import Page from '../components/Page'
import Button from '../components/Button'
import VehiclePlate from '../components/VehiclePlate'
import { Field } from '../components/Field'
import { Notice, Skeleton } from '../components/Feedback'
import { api } from '../lib/api'
import { EASE, prefersReducedMotion } from '../lib/motion'
import { useSmooth } from '../lib/smooth'
import { billedDays, date, dateTime, money, toInputDT } from '../lib/format'

const STEPS = ['Car', 'Client', 'Dates', 'Plan', 'Confirm']

const slide = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

function defaultDates() {
  const a = new Date()
  a.setDate(a.getDate() + 1)
  a.setHours(10, 0, 0, 0)
  const b = new Date(a)
  b.setDate(b.getDate() + 2)
  return [toInputDT(a), toInputDT(b)]
}

const EMPTY_CLIENT = { full_name: '', phone: '', email: '', license_number: '', license_expiry: '', address: '' }

export default function Reserve() {
  const [params] = useSearchParams()
  const [[step, dir], setStep] = useState([0, 1])
  const [vehicles, setVehicles] = useState(null)
  const [customers, setCustomers] = useState(null)
  const [plans, setPlans] = useState([])
  const [loadError, setLoadError] = useState(null)

  const [vehicleId, setVehicleId] = useState(params.get('vehicle') ? Number(params.get('vehicle')) : null)
  const [customerId, setCustomerId] = useState(null)
  const [[pickup, ret], setDates] = useState(() => {
    const [a, b] = defaultDates()
    return [params.get('pickup') || a, params.get('return') || b]
  })
  const [planId, setPlanId] = useState(null)

  const [clientMode, setClientMode] = useState('existing')
  const [query, setQuery] = useState('')
  const [client, setClient] = useState(EMPTY_CLIENT)
  const [clientError, setClientError] = useState(null)
  const [savingClient, setSavingClient] = useState(false)

  const [availability, setAvailability] = useState({ state: 'idle' })
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState(null)

  const reduce = prefersReducedMotion()
  const head = useRef(null)
  const { lenis } = useSmooth()

  useEffect(() => {
    Promise.all([api.vehicles(), api.customers()])
      .then(([v, c]) => {
        setVehicles(v.filter((x) => !['MAINTENANCE', 'RETIRED'].includes(x.status)))
        setCustomers(c)
      })
      .catch((e) => setLoadError(e.message))
  }, [])

  const vehicle = useMemo(() => vehicles?.find((v) => v.vehicle_id === vehicleId) || null, [vehicles, vehicleId])
  const customer = useMemo(() => customers?.find((c) => c.customer_id === customerId) || null, [customers, customerId])
  const plan = plans.find((p) => p.rate_plan_id === planId) || null
  const datesValid = pickup && ret && ret > pickup
  const days = datesValid ? billedDays(pickup, ret) : 0
  const licenceLapses = customer && datesValid && customer.license_expiry < pickup.slice(0, 10)

  // Rate plans follow the vehicle's category.
  useEffect(() => {
    if (!vehicle) return
    api.ratePlans(vehicle.category_id).then((p) => {
      setPlans(p)
      setPlanId((cur) => (p.some((x) => x.rate_plan_id === cur) ? cur : p[0]?.rate_plan_id ?? null))
    }).catch(() => setPlans([]))
  }, [vehicle])

  // Live availability check for the chosen car and dates.
  useEffect(() => {
    if (!vehicle || !datesValid) { setAvailability({ state: 'idle' }); return undefined }
    let live = true
    setAvailability({ state: 'checking' })
    const t = setTimeout(() => {
      api.availability({ category_id: vehicle.category_id, branch_id: vehicle.branch_id, pickup, return: ret })
        .then((rows) => live && setAvailability({ state: rows.some((r) => r.vehicle_id === vehicle.vehicle_id) ? 'free' : 'taken' }))
        .catch(() => live && setAvailability({ state: 'idle' }))
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [vehicle, pickup, ret, datesValid])

  const go = (to) => {
    setSubmitError(null)
    setStep([to, to > step ? 1 : -1])
    // Bring the stepper back into view if the visitor has scrolled past it.
    const top = head.current?.getBoundingClientRect().top ?? 0
    if (top < 0) {
      if (lenis) lenis.scrollTo(head.current, { offset: -100, duration: 1 })
      else head.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  const canNext = [
    !!vehicle,
    !!customer,
    datesValid,
    !!plan,
    true,
  ][step]

  const saveClient = async (e) => {
    e.preventDefault()
    setClientError(null)
    setSavingClient(true)
    try {
      const created = await api.createCustomer(client)
      setCustomers((list) => [...(list || []), created])
      setCustomerId(created.customer_id)
      setClient(EMPTY_CLIENT)
      setClientMode('existing')
    } catch (err) {
      setClientError(err.message)
    } finally {
      setSavingClient(false)
    }
  }

  const confirm = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.createReservation({
        customer_id: customer.customer_id,
        vehicle_id: vehicle.vehicle_id,
        rate_plan_id: plan.rate_plan_id,
        branch_id: vehicle.branch_id,
        planned_pickup: pickup,
        planned_return: ret,
      })
      setBooked(res)
    } catch (err) {
      setSubmitError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCustomers = (customers || []).filter((c) =>
    `${c.full_name} ${c.phone} ${c.license_number}`.toLowerCase().includes(query.toLowerCase()))

  if (booked) {
    return (
      <Page className="reserve container" title="Reservation confirmed">
        <section className="confirmed" aria-live="polite">
          <svg className="confirmed__check" viewBox="0 0 120 120" aria-hidden="true">
            <motion.circle cx="60" cy="60" r="54" fill="none" stroke="url(#chk)" strokeWidth="1.2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.4, ease: EASE }} />
            <motion.path d="M38 62 L54 77 L84 45" fill="none" style={{ stroke: 'var(--ink)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 1, ease: EASE }} />
            <defs>
              <linearGradient id="chk" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c3c5c9" /><stop offset=".5" stopColor="#5d6065" /><stop offset="1" stopColor="#d6d7d9" />
              </linearGradient>
            </defs>
          </svg>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 1.3, duration: 1, ease: EASE }}>
            <p className="script confirmed__script">Thank you</p>
            <h1 className="h-lg">Reservation <span className="num">#{booked.reservation_id}</span> is confirmed.</h1>
            <p className="lede confirmed__lede">
              {booked.customer_name}, the {booked.model_name} will be ready at {booked.branch_name} on {dateTime(booked.planned_pickup)}.
              Please bring your driving licence.
            </p>
            <div className="confirmed__actions">
              <Button to="/fleet" variant="ghost">Back to the fleet</Button>
              <Button to="/admin/reservations" variant="solid">Open at the desk</Button>
            </div>
          </motion.div>
        </section>
      </Page>
    )
  }

  return (
    <Page className="reserve container" title="Reserve">
      <header className="reserve__head" ref={head}>
        <h1 className="h-xl">Reserve a <em className="it">car</em></h1>
        <ol className="stepper" aria-label="Booking progress">
          {STEPS.map((s, i) => (
            <li key={s} className={`stepper__item ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
              <button disabled={i > step} onClick={() => i < step && go(i)}>{s}</button>
            </li>
          ))}
        </ol>
        <div className="stepper__track" aria-hidden="true">
          <motion.span className="stepper__fill" animate={{ scaleX: (step + 1) / STEPS.length }} transition={{ duration: 0.9, ease: EASE }} />
        </div>
      </header>

      {loadError && <Notice title="Could not load booking data">{loadError}</Notice>}

      <div className="reserve__layout">
        <div className="reserve__stage">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={step}
              custom={dir}
              variants={reduce ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } } : slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.55, ease: EASE }}
              className="reserve__step"
              aria-labelledby={`step-${step}`}
            >
              {step === 0 && (
                <>
                  <h2 id="step-0" className="h-md">Which car?</h2>
                  {!vehicles && <div className="pick-list">{[0, 1, 2].map((i) => <Skeleton key={i} className="skeleton--row" />)}</div>}
                  <div className="pick-list" role="radiogroup" aria-label="Vehicles">
                    {vehicles?.map((v) => (
                      <button key={v.vehicle_id} role="radio" aria-checked={vehicleId === v.vehicle_id}
                        className={`pick pick--car ${vehicleId === v.vehicle_id ? 'is-on' : ''}`} onClick={() => setVehicleId(v.vehicle_id)}>
                        <VehiclePlate vehicle={v} size="sm" />
                        <span className="pick__main">
                          <span className="pick__title">{v.model_name}</span>
                          <span className="pick__sub">{v.category_name}, {v.seating_capacity} seats, {v.city}</span>
                        </span>
                        <span className="pick__aside num">{money(v.from_daily_rate)}/day</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h2 id="step-1" className="h-md">Who is driving?</h2>
                  <div className="toggle" role="tablist" aria-label="Client type">
                    {[['existing', 'Existing client'], ['new', 'New client']].map(([k, label]) => (
                      <button key={k} role="tab" aria-selected={clientMode === k} className={`toggle__btn ${clientMode === k ? 'is-on' : ''}`} onClick={() => setClientMode(k)}>
                        {clientMode === k && <motion.span layoutId="client-toggle" className="toggle__bg" transition={{ duration: 0.5, ease: EASE }} />}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  {clientMode === 'existing' ? (
                    <>
                      <div className="search">
                        <MagnifyingGlass size={18} weight="light" aria-hidden="true" />
                        <Field label="Search by name, phone or licence" value={query} onChange={(e) => setQuery(e.target.value)} />
                      </div>
                      <div className="pick-list" role="radiogroup" aria-label="Clients">
                        {filteredCustomers.map((c) => (
                          <button key={c.customer_id} role="radio" aria-checked={customerId === c.customer_id}
                            className={`pick ${customerId === c.customer_id ? 'is-on' : ''}`} onClick={() => setCustomerId(c.customer_id)}>
                            <span className="pick__main">
                              <span className="pick__title">{c.full_name}</span>
                              <span className="pick__sub">Licence {c.license_number}, valid until {date(c.license_expiry)}</span>
                            </span>
                            {c.license_expired ? <span className="pick__flag">Licence expired</span> : null}
                          </button>
                        ))}
                        {customers && filteredCustomers.length === 0 && <p className="muted-note">No client matches. Add them as a new client.</p>}
                      </div>
                    </>
                  ) : (
                    <form className="form-grid" onSubmit={saveClient}>
                      <Field label="Full name" value={client.full_name} onChange={(e) => setClient({ ...client, full_name: e.target.value })} required maxLength={60} autoComplete="name" />
                      <Field label="Phone" inputMode="numeric" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} required maxLength={15} autoComplete="tel" hint="Digits only" />
                      <Field label="Email" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} maxLength={80} autoComplete="email" />
                      <Field label="Licence number" value={client.license_number} onChange={(e) => setClient({ ...client, license_number: e.target.value })} required maxLength={20} />
                      <Field label="Licence expiry" type="date" value={client.license_expiry} onChange={(e) => setClient({ ...client, license_expiry: e.target.value })} required />
                      <Field label="Address" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} maxLength={120} autoComplete="street-address" />
                      <AnimatePresence>{clientError && <Notice title="Client not saved">{clientError}</Notice>}</AnimatePresence>
                      <div className="form-grid__actions">
                        <Button type="submit" variant="solid" disabled={savingClient}>{savingClient ? 'Saving' : 'Save client'}</Button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <h2 id="step-2" className="h-md">When?</h2>
                  <div className="form-grid form-grid--2">
                    <Field label="Pickup" type="datetime-local" value={pickup} onChange={(e) => setDates([e.target.value, ret])} required />
                    <Field label="Return" type="datetime-local" value={ret} onChange={(e) => setDates([pickup, e.target.value])} required
                      error={pickup && ret && !datesValid ? 'Return must be after pickup.' : undefined} />
                  </div>
                  <div className="avail" aria-live="polite">
                    <AnimatePresence mode="wait">
                      {availability.state === 'checking' && <motion.p key="c" className="avail__msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Checking the {vehicle?.model_name}</motion.p>}
                      {availability.state === 'free' && <motion.p key="f" className="avail__msg avail__msg--ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>The {vehicle?.model_name} is free for these dates.</motion.p>}
                      {availability.state === 'taken' && (
                        <Notice key="t" title="Already reserved in this period">
                          The {vehicle?.model_name} has another booking that overlaps these dates. You can still try, but the reservation will be refused.
                        </Notice>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {licenceLapses && (
                        <Notice key="l" title="Licence will have expired">
                          {customer.full_name}&apos;s licence expires on {date(customer.license_expiry)}, before this pickup. The booking will be refused.
                        </Notice>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 id="step-3" className="h-md">Rate plan</h2>
                  <div className="pick-list" role="radiogroup" aria-label="Rate plans">
                    {plans.map((p) => (
                      <button key={p.rate_plan_id} role="radio" aria-checked={planId === p.rate_plan_id}
                        className={`pick pick--plan ${planId === p.rate_plan_id ? 'is-on' : ''}`} onClick={() => setPlanId(p.rate_plan_id)}>
                        <span className="pick__main">
                          <span className="pick__title">{p.plan_name}</span>
                          <span className="pick__sub">
                            200 km a day included, then {money(p.extra_km_rate, true)} per km. Late returns {money(p.late_fee_per_hour)} per hour.
                          </span>
                        </span>
                        <span className="pick__aside num">{money(p.daily_rate)}/day</span>
                      </button>
                    ))}
                    {plans.length === 0 && <p className="muted-note">No rate plan exists for this class yet.</p>}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h2 id="step-4" className="h-md">Review and confirm</h2>
                  <dl className="review">
                    <div><dt>Car</dt><dd>{vehicle?.model_name} <span className="muted num">{vehicle?.registration_no}</span></dd></div>
                    <div><dt>Client</dt><dd>{customer?.full_name}</dd></div>
                    <div><dt>Pickup</dt><dd>{dateTime(pickup)}, {vehicle?.branch_name}</dd></div>
                    <div><dt>Return</dt><dd>{dateTime(ret)}</dd></div>
                    <div><dt>Plan</dt><dd>{plan?.plan_name}, {money(plan?.daily_rate)} a day</dd></div>
                  </dl>
                  <AnimatePresence>
                    {submitError && (
                      <Notice
                        title={submitError.kind === 'business_rule' ? 'This reservation cannot be made' : 'Something went wrong'}
                        action={
                          <div className="notice__actions">
                            <button className="text-link" onClick={() => go(2)}>Change dates</button>
                            <button className="text-link" onClick={() => go(1)}>Change client</button>
                            <button className="text-link" onClick={() => go(0)}>Change car</button>
                          </div>
                        }
                      >
                        {submitError.message}
                      </Notice>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.section>
          </AnimatePresence>

          <div className="reserve__nav">
            {step > 0 ? (
              <button className="text-link" onClick={() => go(step - 1)}><ArrowLeft size={16} weight="light" /> Back</button>
            ) : <span />}
            {step < STEPS.length - 1 ? (
              <Button variant="solid" disabled={!canNext} onClick={() => go(step + 1)} icon={<ArrowRight size={16} weight="light" />}>Continue</Button>
            ) : (
              <Button variant="chrome" disabled={submitting} onClick={confirm} cursor="Reserve">{submitting ? 'Confirming' : 'Confirm reservation'}</Button>
            )}
          </div>
        </div>

        <aside className="summary" aria-label="Booking summary">
          <AnimatePresence mode="wait">
            {vehicle ? (
              <motion.div key={vehicle.vehicle_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                <VehiclePlate vehicle={vehicle} />
                <p className="summary__name">{vehicle.model_name}</p>
                <p className="summary__sub">{vehicle.category_name}, {vehicle.branch_name}</p>
              </motion.div>
            ) : (
              <motion.p key="none" className="summary__empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Choose a car to begin.</motion.p>
            )}
          </AnimatePresence>
          <dl className="summary__lines">
            <div><dt>Client</dt><dd>{customer?.full_name || '-'}</dd></div>
            <div><dt>Days billed</dt><dd className="num">{datesValid ? days : '-'}</dd></div>
            <div><dt>Collect</dt><dd>{datesValid ? dateTime(pickup) : '-'}</dd></div>
            <div><dt>Return</dt><dd>{datesValid ? dateTime(ret) : '-'}</dd></div>
          </dl>
          <span className="rule" aria-hidden="true" />
          <div className="summary__total">
            <span>Estimated rental</span>
            <span className="num">{plan && datesValid ? money(plan.daily_rate * days) : '-'}</span>
          </div>
          <p className="summary__note">Billed on return: days used x daily rate, extra kilometres, late hours and any damage, plus 18% tax.</p>
        </aside>
      </div>
    </Page>
  )
}
