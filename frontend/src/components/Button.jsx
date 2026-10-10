import { Link } from 'react-router-dom'
import Magnetic from './Magnetic'

/*
 * variants: solid (ink), chrome (brushed metal), ghost (hairline).
 * All buttons are full-pill (shape rule). Hover runs a chrome sheen sweep.
 */
export default function Button({
  to, href, variant = 'solid', size = 'md', icon, children, cursor, magnetic = true, className, ...rest
}) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ')
  const inner = (
    <>
      <span className="btn__label">{children}</span>
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      <span className="btn__sheen" aria-hidden="true" />
    </>
  )
  let el
  if (to) el = <Link to={to} className={cls} data-cursor={cursor} {...rest}>{inner}</Link>
  else if (href) el = <a href={href} className={cls} data-cursor={cursor} {...rest}>{inner}</a>
  else el = <button type="button" className={cls} data-cursor={cursor} {...rest}>{inner}</button>
  return magnetic ? <Magnetic>{el}</Magnetic> : el
}
