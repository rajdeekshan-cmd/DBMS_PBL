import { Link } from 'react-router-dom'

export default function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`logo ${className}`} aria-label="Woxsen Car Rentals, home">
      <span className="logo__word">Woxsen</span>
      <span className="logo__sub" aria-hidden="true">Car Rentals</span>
    </Link>
  )
}
