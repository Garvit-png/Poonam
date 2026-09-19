import { useEffect, useRef, useState } from 'react';
import './Shop.css';

const books = [
  {
    id: 1,
    img: '/book1.png',
    title: 'Vedic Astrology Unveiled',
    subtitle: '',
    price: '₹999',
    originalPrice: '₹1,499',
    desc: 'Decode the secrets of your birth chart with this comprehensive guide to Vedic astrology, written by Poonam Chaudhary.',
    buyLink: 'https://rzp.io/rzp/KQgU3Qe9',
    stars: 5,
    features: [],
  },
  {
    id: 2,
    img: '/book2.png',
    title: 'Cosmic Love & Destiny',
    subtitle: '',
    price: '₹799',
    originalPrice: '₹1,199',
    desc: 'Understand your relationships, compatibility, and karmic bonds through the ancient wisdom of Vedic astrology.',
    buyLink: 'https://rzp.io/rzp/atkIt7w',
    stars: 5,
    features: [],
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="book-stars">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i}>★</span>
      ))}
    </div>
  );
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('.book-row');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
          else e.target.classList.remove('visible');
        });
      },
      { threshold: 0.1 }
    );
    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Shop() {
  const listRef = useScrollReveal();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="shop-section" id="shop">
      <div className="shop-inner">

        {/* ── Header ── */}
        <div className="shop-header">
          <span className="shop-tag">✦ &nbsp; BUY FROM US &nbsp; ✦</span>
          <h2 className="shop-title">Sacred Knowledge,<br />Bound in Pages</h2>
          <p className="shop-subtitle">
            Handcrafted guides by Poonam Chaudhary — carry the wisdom of the cosmos with you.
          </p>
        </div>

        {/* ── Book rows ── */}
        <div className="book-list" ref={listRef}>
          {books.map((book) => (
            <div
              key={book.id}
              className="book-row"
              onMouseEnter={() => setHovered(book.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* ── Book visual ── */}
              <div className={`book-visual${hovered === book.id ? ' hovered' : ''}`}>
                {/* Glow orb behind book */}
                <div className="book-glow" />

                {/* 3D book mockup */}
                <div className="book-3d">
                  <div className="book-cover">
                    <img src={book.img} alt={book.title} />
                  </div>
                  <div className="book-spine" />
                  <div className="book-shadow" />
                </div>

                

                {/* Floating price pill */}
                <div className="book-float-price">
                  <span className="fp-current">{book.price}</span>
                  <span className="fp-original">{book.originalPrice}</span>
                </div>
              </div>

              {/* ── Book info ── */}
              <div className="book-info">
                <div className="book-info-top">
                  <Stars count={book.stars} />
                </div>

                <h3 className="book-title">{book.title}</h3>
                <p className="book-subtitle-text">{book.subtitle}</p>
                <p className="book-desc">{book.desc}</p>

                {/* Feature pills */}
                <div className="book-features">
                  {book.features.map((f) => (
                    <span key={f} className="book-feature">{f}</span>
                  ))}
                </div>

                {/* CTA row */}
                <div className="book-cta">
                  <a
                    href={book.buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="book-buy-btn"
                  >
                    Buy Now &nbsp;→
                  </a>
                  <div className="book-price-inline">
                    <span className="bpi-current">{book.price}</span>
                    <span className="bpi-original">{book.originalPrice}</span>
                  </div>
                </div>

                
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
