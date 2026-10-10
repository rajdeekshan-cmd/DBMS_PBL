import { useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { EASE, prefersReducedMotion } from '../../lib/motion'

/*
 * Single-series charts (no legend: the panel title names the series).
 * Ink marks on a recessive hairline grid, one y-axis, hover tooltip per mark.
 * Bars grow from the baseline and lines stroke in when scrolled into view.
 */
const W = 640
const H = 260
const PAD = { t: 18, r: 12, b: 46, l: 56 }

// Nice ticks: steps of 1, 2 or 5 x 10^n; whole-number data never gets fractional ticks.
function scale(values) {
  const max = Math.max(0, ...values)
  const ints = values.every((v) => Number.isInteger(v))
  if (max <= 0) return { max: 1, ticks: [0, 1] }
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
  if (ints) step = Math.max(1, Math.round(step))
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(t)
  return { max: top, ticks }
}

const short = (s) => String(s).replace(/ Branch$/, '')

function useChartView() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  return [ref, inView || prefersReducedMotion()]
}

function Grid({ max, ticks, fmt }) {
  const ih = H - PAD.t - PAD.b
  return ticks.map((t) => {
    const y = PAD.t + ih - (t / max) * ih
    return (
      <g key={t}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className={t === 0 ? 'chart__base' : 'chart__grid'} />
        <text x={PAD.l - 10} y={y + 4} className="chart__tick" textAnchor="end">{fmt(t)}</text>
      </g>
    )
  })
}

export function BarChart({ data, label, value, fmt = (n) => Math.round(n).toLocaleString('en-IN'), title }) {
  const [ref, show] = useChartView()
  const [hover, setHover] = useState(null)
  const { max, ticks } = useMemo(() => scale(data.map(value)), [data, value])
  if (!data.length) return null
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const slot = iw / data.length
  const bw = Math.min(26, slot * 0.34)

  return (
    <figure className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <Grid max={max} ticks={ticks} fmt={fmt} />
        {data.map((d, i) => {
          const v = value(d)
          const h = (v / max) * ih
          const x = PAD.l + slot * i + (slot - bw) / 2
          const y = PAD.t + ih - h
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih} fill="transparent" />
              <motion.path
                d={`M${x},${PAD.t + ih} V${y + 2} Q${x},${y} ${x + 2},${y} H${x + bw - 2} Q${x + bw},${y} ${x + bw},${y + 2} V${PAD.t + ih} Z`}
                className={`chart__bar ${hover === i ? 'is-hover' : ''}`}
                style={{ originY: 1, transformBox: 'fill-box' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: show ? 1 : 0 }}
                transition={{ duration: 1.1, delay: i * 0.08, ease: EASE }}
              />
              <text x={x + bw / 2} y={H - PAD.b + 18} className="chart__label" textAnchor="middle">
                {short(label(d))}
              </text>
              {hover === i && (
                <g className="chart__tip" pointerEvents="none">
                  <rect x={Math.min(Math.max(x + bw / 2 - 70, 4), W - 144)} y={Math.max(y - 46, 2)} width="140" height="36" />
                  <text x={Math.min(Math.max(x + bw / 2, 74), W - 74)} y={Math.max(y - 23, 25)} textAnchor="middle">
                    {short(label(d))}: {fmt(v)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export function LineChart({ data, label, value, fmt = (n) => Math.round(n).toLocaleString('en-IN'), title }) {
  const [ref, show] = useChartView()
  const [hover, setHover] = useState(null)
  const { max, ticks } = useMemo(() => scale(data.map(value)), [data, value])
  if (!data.length) return null
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const pts = data.map((d, i) => {
    const x = PAD.l + (data.length === 1 ? iw / 2 : (iw / (data.length - 1)) * i)
    const y = PAD.t + ih - (value(d) / max) * ih
    return [x, y]
  })
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')

  return (
    <figure className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onPointerLeave={() => setHover(null)}>
        <Grid max={max} ticks={ticks} fmt={fmt} />
        <motion.path d={path} className="chart__line" initial={{ pathLength: 0 }} animate={{ pathLength: show ? 1 : 0 }}
          transition={{ duration: 1.6, ease: EASE }} />
        {pts.map(([x, y], i) => (
          <g key={i} onPointerEnter={() => setHover(i)}>
            <rect x={x - 20} y={PAD.t} width="40" height={ih} fill="transparent" />
            {hover === i && <line x1={x} x2={x} y1={PAD.t} y2={PAD.t + ih} className="chart__cross" />}
            <motion.circle cx={x} cy={y} r={hover === i ? 5 : 4} className="chart__dot"
              initial={{ opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} transition={{ delay: 0.8 + i * 0.08, duration: 0.5 }} />
            <text x={x} y={H - PAD.b + 18} className="chart__label" textAnchor="middle">{label(data[i])}</text>
            {hover === i && (
              <g className="chart__tip" pointerEvents="none">
                <rect x={Math.min(Math.max(x - 70, 4), W - 144)} y={Math.max(y - 46, 2)} width="140" height="36" />
                <text x={Math.min(Math.max(x, 74), W - 74)} y={Math.max(y - 23, 25)} textAnchor="middle">{fmt(value(data[i]))}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </figure>
  )
}
