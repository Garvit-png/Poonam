import { useEffect, useRef } from 'react';
import AeroShards from './AeroShards';
import './Shop.css';

const books = [
  {
    id: 1,
    img: '/images/book1.png',
    title: 'Vedic Astrology Unveiled',
    subtitle: 'A Complete Guide to Birth Charts',
    price: '₹999',
    originalPrice: '₹1,499',
    desc: 'Decode the secrets of your birth chart with this comprehensive guide to Vedic astrology, written by Poonam Chaudhary.',
  },
  {
    id: 2,
    img: '/images/book2.png',
    title: 'Cosmic Love & Destiny',
    subtitle: 'Relationships Through the Stars',
    price: '₹799',
    originalPrice: '₹1,199',
    desc: 'Understand your relationships, compatibility, and karmic bonds through the ancient wisdom of Vedic astrology.',
  },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('.shop-card');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
          else entry.target.classList.remove('visible');
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Shop() {
  const cardsRef = useScrollReveal();

  return (
    <section className="shop-section" id="shop">

      {/* AeroShards background */}
      <div className="shop-bg" aria-hidden="true">
        <AeroShards
          backgroundColor="#0d0a1f"
          shardColor="#896ABD"
          accentColor="#A855F7"
          placement="full"
          flow="stream"
          material="pearl"
          detail="balanced"
          effect="none"
          scale={1}
          spread={1}
          depth={1}
          speed={0.8}
          spin={1}
          interaction="repel"
          density={1.2}
          shardSize={1.0}
          stretch={1}
          turbulence={1}
          glow={1}
          edgeSoftness={2}
          bloom={0.4}
          grain={0.04}
          chromaticAberration={0.005}
          transitionDuration={1}
          interactionRadius={1.5}
          interactionStrength={0.4}
          rippleIntensity={0.8}
          holdToGather
          paused={false}
        />
      </div>

      {/* Top fade from Services */}
      <div className="shop-overlay" aria-hidden="true" />

      <div className="shop-inner">

        {/* Header */}
        <div className="shop-header">
          <span className="shop-tag">✦ &nbsp; BUY FROM US &nbsp; ✦</span>
          <h2 className="shop-title">Sacred Knowledge,<br />Bound in Pages</h2>
          <p className="shop-subtitle">
            Handcrafted guides by Poonam Chaudhary — carry the wisdom of the cosmos with you.
          </p>
        </div>

        {/* Book cards */}
        <div className="shop-cards" ref={cardsRef}>
          {books.map((book, i) => (
            <div
              key={book.id}
              className="shop-card"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Book image */}
              <div className="shop-card-img-wrap">
                <img
                  src={book.img}
                  alt={book.title}
                  className="shop-card-img"
                  onError={(e) => {
                    // fallback if image not found
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="shop-card-img-placeholder" aria-hidden="true">
                  <span>📖</span>
                </div>
                <div className="shop-card-badge">Bestseller</div>
              </div>

              {/* Info */}
              <div className="shop-card-body">
                <p className="shop-card-subtitle">{book.subtitle}</p>
                <h3 className="shop-card-title">{book.title}</h3>
                <p className="shop-card-desc">{book.desc}</p>

                <div className="shop-card-footer">
                  <div className="shop-card-price">
                    <span className="price-current">{book.price}</span>
                    <span className="price-original">{book.originalPrice}</span>
                  </div>
                  <a href="#contact" className="shop-buy-btn">
                    Buy Now →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="shop-note">
          Free delivery across India &nbsp;✦&nbsp; 100% authentic &nbsp;✦&nbsp; Signed copies available
        </p>

      </div>
    </section>
  );
}
