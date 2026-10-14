import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Footer() {
  const [branches, setBranches] = useState([])
  useEffect(() => {
    api.branches().then(setBranches).catch(() => setBranches([]))
  }, [])

  return (
    <footer className="footer">
      <div className="container">
        <span className="rule" aria-hidden="true" />
        <div className="footer__grid">
          <div className="footer__brand">
            <p className="footer__word">Woxsen</p>
            <p className="footer__sub">Car Rentals</p>
            <p className="footer__note">Cars reserved by the day, prepared by hand, handed over in person.</p>
          </div>
          <div className="footer__col">
            <p className="footer__head">Visit</p>
            <ul>
              {branches.map((b) => (
                <li key={b.branch_id}>
                  <span className="footer__city">{b.city}</span>
                  <span>{b.address}</span>
                  <a href={`tel:${b.phone}`} className="footer__tel">{b.phone}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer__col">
            <p className="footer__head">Navigate</p>
            <ul>
              <li><Link to="/fleet">Fleet and availability</Link></li>
              <li><Link to="/reserve">Reserve</Link></li>
              <li><Link to="/admin">Concierge desk</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span>© {new Date().getFullYear()} Woxsen Car Rentals</span>
          <span>Licence checked at every booking</span>
        </div>
      </div>
    </footer>
  )
}
