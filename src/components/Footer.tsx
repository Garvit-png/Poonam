import { Link } from 'react-router-dom';
import './Footer.css';

const footerLinks = {
  Horoscope: ['Daily Horoscope', 'Weekly Horoscope', 'Birth Chart', 'Zodiac Signs'],
  Tarot: ['Yes or No Tarot', 'Daily Tarot', 'Major Arcana', 'Minor Arcana'],
  Astrology: ['Angel Numbers', 'Moon Cycle', 'Archangels', 'Numerology'],
  Reading: ['Love Compatibility', 'In-Depth Love', 'Dreams Come True', 'Past Present Future'],
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        {/* Brand */}
        <div className="footer-brand">
          <div className="logo-wrap">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="rgba(124,92,191,0.6)" strokeWidth="1.5" />
              <path d="M18 4 C10 4, 4 10, 4 18 C4 26, 10 32, 18 32" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="18" cy="18" r="4" fill="rgba(167,139,250,0.7)" />
            </svg>
            <div className="nav-logo-text">
              <span className="brand">MOONLIT ✦</span>
              <span className="sub">ASTRO</span>
            </div>
          </div>
          <p>Your trusted guide through the cosmos. Explore astrology, tarot, numerology, and more.</p>
          <div className="social-links">
            {['𝕏', 'f', 'in', '▶'].map((icon) => (
              <a key={icon} className="social-btn" href="#">
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title} className="footer-col">
            <h4>{title}</h4>
            {links.map((link) => (
              <Link key={link} to="#">
                {link}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <p>All Rights Reserved. 2025 — Moonlit Astro</p>
        <div className="footer-bottom-links">
          <Link to="#">Privacy Policy</Link>
          <Link to="#">Disclaimer</Link>
        </div>
      </div>
    </footer>
  );
}
