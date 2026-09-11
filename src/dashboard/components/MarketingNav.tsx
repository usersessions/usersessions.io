import Link from 'next/link'
import React from 'react'

export function MarketingNav() {
  return (
    <nav className="nav">
      <div className="nav-glass">
        <div className="wrap">
          <Link href="/" className="nav-mark" style={{ textDecoration: 'none' }}>
            usersessions<span>.io</span>
          </Link>
          <ul className="nav-links">
            <li><Link href="/#demo">Live demo</Link></li>
            <li><Link href="/#plan">How it works</Link></li>
            <li><Link href="/#pricing">Pricing</Link></li>
          </ul>
          <div className="nav-cta">
            <Link className="nav-signin" href="/login">Sign in</Link>
            <Link className="btn btn--ember" href="/login">Start free trial →</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
