import { useEffect, useRef } from 'react';
import './StarField.css';

export default function StarField() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Stars
    for (let i = 0; i < 80; i++) {
      const star = document.createElement('div');
      star.className =
        'star-point' +
        (Math.random() > 0.85 ? ' lg' : '') +
        (Math.random() > 0.92 ? ' glow' : '');
      star.style.setProperty('--d', `${2 + Math.random() * 4}s`);
      star.style.setProperty('--delay', `-${Math.random() * 5}s`);
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      container.appendChild(star);
    }

    // Shooting stars
    for (let i = 0; i < 3; i++) {
      const ss = document.createElement('div');
      ss.className = 'shooting-star';
      ss.style.setProperty('--dur', `${3 + Math.random() * 4}s`);
      ss.style.setProperty('--delay', `${i * 3}s`);
      ss.style.left = `${Math.random() * 60}%`;
      ss.style.top = `${Math.random() * 40}%`;
      container.appendChild(ss);
    }

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="star-field" />;
}
