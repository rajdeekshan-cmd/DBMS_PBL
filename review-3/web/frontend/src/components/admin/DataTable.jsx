import { motion } from 'motion/react'
import { EASE, prefersReducedMotion } from '../../lib/motion'
import { Skeleton } from '../Feedback'

/*
 * columns: [{ key, label, render?(row), align?: 'right', className? }]
 * Rows rise in with a short stagger when data arrives; hover draws a chrome hairline.
 */
export default function DataTable({ columns, rows, rowKey, loading, empty = 'Nothing here yet.', onRowClick, caption }) {
  const reduce = prefersReducedMotion()
  return (
    <div className="table-wrap" data-lenis-prevent-wheel>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? 'is-right' : ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows && [0, 1, 2, 3].map((i) => (
            <tr key={`s${i}`} aria-hidden="true">
              {columns.map((c) => <td key={c.key}><Skeleton style={{ height: 14, width: '70%' }} /></td>)}
            </tr>
          ))}
          {rows?.map((row, i) => (
            <motion.tr
              key={rowKey(row)}
              className={onRowClick ? 'is-clickable' : ''}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: Math.min(i, 14) * 0.04, ease: EASE }}
            >
              {columns.map((c) => (
                <td key={c.key} className={[c.align === 'right' ? 'is-right num' : '', c.className].filter(Boolean).join(' ')} data-label={c.label}>
                  {c.render ? c.render(row) : row[c.key] ?? '-'}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
      {rows && rows.length === 0 && <p className="table-empty">{empty}</p>}
    </div>
  )
}
