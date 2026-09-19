import { useEffect, useRef } from 'react';
import GradientWaves from './GradientWaves';
import './Services.css';

const services = [
  {
    num: '01',
    icon: '☿',
    title: 'Birth Chart Reading',
    desc: 'Uncover your life purpose, strengths, and karmic lessons through a detailed Vedic birth chart analysis.',
  },
  {
    num: '02',
    icon: '♀',
    title: 'Love Compatibility',
    desc: 'Understand the cosmic chemistry between you and your partner through kundli matching and synastry.',
  },
  {
    num: '03',
    icon: '♃',
    title: 'Career Consultation',
    desc: 'Discover your ideal career path, best timing for job changes, and how to overcome professional obstacles.',
  },
  {
    num: '04',
    icon: '☽',
    title: 'Marriage Consultation',
    desc: 'Find the auspicious time for marriage, compatibility analysis, and guidance for a harmonious married life.',
  },
  {
    num: '05',
    icon: '♄',
    title: 'Business Astrology',
    desc: 'Choose the right time to launch, expand, or pivot your business using planetary cycles and Muhurta.',
  },
  {
    num: '06',
    icon: '✦',
    title: 'Gemstone Guidance',
    desc: 'Receive personalised gemstone recommendations based on your birth chart to enhance positive planetary energies.',
  },
];

// Hook — observe elements, add/remove .visible class
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = el.querySelectorAll<HTMLElement>('.srv-row');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          } else {
            // remove so it re-animates when scrolled back
            entry.target.classList.remove('visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);

  return ref;
}

export default function Services() {
  const listRef = useScrollReveal();

  return (
    <section className="services-section" id="services">

      {/* Background */}
      <div className="services-bg" aria-hidden="true">
        <GradientWaves
          horizonColor="#0d0a1f"
          waveColor="#2a1060"
          crestColor="#6b3fa0"
          speed={0.3}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={0.9}
          opacity={1}
          mouseInteraction
          parallaxStrength={0.3}
          grain
          grainIntensity={0.04}
        />
      </div>

      <div className="services-overlay" aria-hidden="true" />

      <div className="services-inner">

        {/* ── Section header ── */}
        <div className="services-header">
          <span className="services-tag">✦ &nbsp; SERVICES &nbsp; ✦</span>
          <h2 className="services-title">Personalized<br />Guidance</h2>
          <p className="services-subtitle">Ancient Vedic wisdom tailored to your unique birth chart.</p>
        </div>

        {/* ── Service rows ── */}
        <div className="srv-list" ref={listRef}>
          {services.map((s, i) => (
            <div
              key={s.num}
              className="srv-row"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {/* Left — number + title */}
              <div className="srv-left">
                <span className="srv-num">{s.num}</span>
                <div className="srv-title-wrap">
                  <span className="srv-icon">{s.icon}</span>
                  <h3 className="srv-title">{s.title}</h3>
                </div>
              </div>

              {/* Divider */}
              <div className="srv-divider" aria-hidden="true" />

              {/* Right — description */}
              <div className="srv-right">
                <p className="srv-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="services-cta">
          <a href="#contact" className="services-btn-primary">Book a Consultation</a>
          <a href="#contact" className="services-btn-secondary">Get in Touch</a>
        </div>

      </div>
    </section>
  );
}
