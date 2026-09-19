import { useEffect, useState } from 'react';
import Plasma from './Plasma';
import TextPressure from './TextPressure';
import './Hero.css';

export default function Hero() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero-section" aria-label="Hero">
      {/* Curtain */}
      <div className={`hero-curtain${revealed ? ' lifted' : ''}`} aria-hidden="true" />

      {/* Plasma background */}
      <div className="hero-bg" aria-hidden="true">
        <Plasma
          color="#B497CF"
          speed={1}
          direction="forward"
          scale={1}
          opacity={1}
          mouseInteractive={false}
          renderScale={0.55}
          maxDpr={1.5}
          targetFps={60}
          iterations={60}
        />
      </div>

      {/* Content */}
      <div className="hero-content">

        {/* Badge pill */}
        <div className="hero-badge">
          <span className="badge-dot">✦</span>
          Trusted Vedic Astrologer
        </div>

        {/* Big name via TextPressure */}
        <div className="hero-name-wrap">
          <TextPressure
            text="POONAM CHAUDHARY"
            flex
            alpha={false}
            stroke={false}
            width
            weight
            italic
            textColor="#ffffff"
            strokeColor="#d4af37"
            minFontSize={24}
          />
        </div>


        {/* Subtext */}
        <p className="hero-sub">
          Gain clarity in love, career, marriage and personal growth through
          personalized Vedic astrology guidance.
        </p>

        {/* CTAs */}
        <div className="hero-actions" style={{ marginTop: '24px' }}>
          <a href="#contact" className="hero-btn-primary">Book a Consultation</a>
          <a href="#services" className="hero-btn-secondary">Explore Services</a>
        </div>

      </div>

      {/* Scroll hint */}
      <a href="#services" className="hero-scroll" aria-label="Scroll down">
        <div className="scroll-mouse" />
      </a>

      {/* Bottom fade into Services */}
      <div className="hero-fade-bottom" aria-hidden="true" />
    </section>
  );
}
