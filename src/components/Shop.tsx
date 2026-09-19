import { useEffect, useRef, useState } from 'react';
import './Shop.css';

const books = [
  {
    id: 1,
    img: '/book1.png',
    title: 'Vedic Astrology Unveiled',
    price: '₹999',
    originalPrice: '₹1,499',
    buyLink: 'https://rzp.io/rzp/KQgU3Qe9',
  },
  {
    id: 2,
    img: '/book2.png',
    title: 'Cosmic Love & Destiny',
    price: '₹799',
    originalPrice: '₹1,199',
    buyLink: 'https://rzp.io/rzp/atkIt7w',
  },
];

// deterministic floating symbols
const SYMBOLS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','☽','☿','♀','♃','♄','✦','★','⊕'];
const FLOATERS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  symbol: SYMBOLS[i % SYMBOLS.length],
  top:    ((i * 137.5) % 100).toFixed(1),
  left:   ((i * 97.3 + 11) % 100).toFixed(1),
  size:   (14 + (i % 4) * 8).toFixed(0),
  dur:    (18 + (i % 6) * 4).toFixed(0),
  delay:  ((i * 1.3) % 8).toFixed(1),
  opacity:(0.04 + (i % 5) * 0.02).toFixed(2),
}));

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('visible', e.isIntersecting));
    }, { threshold: 0.15 });
    el.querySelectorAll<HTMLElement>('.book-card').forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Shop() {
  const cardsRef = useReveal();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="shop-section" id="shop">

      {/* floating background symbols */}
      <div className="shop-floaters" aria-hidden="true">
        {FLOATERS.map(f => (
          <span
            key={f.id}
            className="shop-floater"
            style={{
              top: `${f.top}%`,
              left: `${f.left}%`,
              fontSize: `${f.size}px`,
              opacity: f.opacity,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
            }}
          >
            {f.symbol}
          </span>
        ))}
      </div>

      <div className="shop-inner">

        {/* Header */}
        <div className="shop-header">
          <span className="shop-tag">✦ &nbsp; BUY FROM US &nbsp; ✦</span>
          <h2 className="shop-title">Sacred Knowledge,<br />Bound in Pages</h2>
        </div>

        {/* Cards — side by side */}
        <div className="shop-cards" ref={cardsRef}>
          {books.map((book, i) => (
            <div
              key={book.id}
              className="book-card"
              style={{ transitionDelay: `${i * 100}ms` }}
              onMouseEnter={() => setHovered(book.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* glow */}
              <div className="book-card-glow" />

              {/* book image with 3d tilt */}
              <div className={`book-img-wrap${hovered === book.id ? ' hovered' : ''}`}>
                <img src={book.img} alt={book.title} />
                <div className="book-spine" />
              </div>

              {/* info row — all in one line */}
              <div className="book-card-info">
                <span className="book-card-title">{book.title}</span>
                <div className="book-card-right">
                  <div className="book-card-prices">
                    <span className="book-price">{book.price}</span>
                    <span className="book-price-og">{book.originalPrice}</span>
                  </div>
                  <a
                    href={book.buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="book-btn"
                  >
                    Buy Now →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
