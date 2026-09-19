import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const navItems = [
  { label: 'Services', href: '#services' },
  { label: 'Guidance', href: '#guidance' },
  { label: 'Contact',  href: '#contact'  },
];

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [hidden,     setHidden]     = useState(false);
  const [visible,    setVisible]    = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location   = useLocation();
  const lastScrollY = useRef(0);

  // Initial entrance
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 20);
      if (current > 80) {
        setHidden(current > lastScrollY.current);
      } else {
        setHidden(false);
      }
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}${hidden ? ' hidden' : ''}${visible ? ' visible' : ''}`}>
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <span className="nav-moon">☽</span>
          <span className="brand">Moonlit Astro</span>
        </Link>

        {/* Center links */}
        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link to={item.href} className={location.hash === item.href ? 'active' : ''}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a href="#contact" className="nav-book-btn">Book Session</a>

        {/* Mobile hamburger */}
        <button
          className={`hamburger${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-menu">
          {navItems.map((item) => (
            <Link key={item.label} to={item.href} className="mobile-link">{item.label}</Link>
          ))}
          <a href="#contact" className="nav-book-btn" style={{ textAlign: 'center' }}>Book Session</a>
        </div>
      )}
    </>
  );
}
