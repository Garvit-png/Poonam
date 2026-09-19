// ===== MOONLIT ASTRO - ANIMATIONS & INTERACTIONS =====

// ---- STAR FIELD ----
function createStarField() {
  const field = document.createElement('div');
  field.className = 'star-field';
  document.body.appendChild(field);

  const count = window.innerWidth < 768 ? 80 : 160;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star-point';
    if (Math.random() > 0.85) star.classList.add('lg');
    if (Math.random() > 0.92) star.classList.add('glow');
    star.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --d: ${2 + Math.random() * 4}s;
      --delay: ${Math.random() * 5}s;
      opacity: ${0.2 + Math.random() * 0.6};
    `;
    field.appendChild(star);
  }

  // Shooting stars
  for (let i = 0; i < 3; i++) {
    const ss = document.createElement('div');
    ss.className = 'shooting-star';
    ss.style.cssText = `
      left: ${Math.random() * 60}%;
      top: ${Math.random() * 40}%;
      --dur: ${3 + Math.random() * 4}s;
      --delay: ${Math.random() * 8}s;
    `;
    field.appendChild(ss);
  }
}

// ---- SPARKLE DECORATIONS ----
function addSparkles(container) {
  const positions = [
    { top: '15%', left: '10%' }, { top: '20%', right: '15%' },
    { top: '60%', left: '5%' }, { bottom: '20%', right: '10%' },
    { top: '40%', right: '5%' }, { bottom: '10%', left: '15%' },
  ];
  positions.forEach((pos, i) => {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = ['✦', '✧', '⊹', '✺', '✸', '✵'][i % 6];
    s.style.cssText = Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';');
    s.style.fontSize = (10 + Math.random() * 8) + 'px';
    s.style.animationDelay = (Math.random() * 4) + 's';
    s.style.color = 'rgba(167,139,250,' + (0.3 + Math.random() * 0.4) + ')';
    container.style.position = 'relative';
    container.appendChild(s);
  });
}

// ---- SCROLL REVEAL ----
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
    .forEach(el => observer.observe(el));
}

// ---- NAVBAR SCROLL EFFECT ----
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ---- PARALLAX HERO ORB ----
function initParallax() {
  const orb = document.querySelector('.hero-orb');
  if (!orb) return;
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    orb.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// ---- TAROT CARD FLIP ----
function initTarotCards() {
  const cards = document.querySelectorAll('.card-flip');
  if (!cards.length) return;

  const results = [
    { r: 'YES ✓', text: 'The stars align in your favor.', emoji: '🌟' },
    { r: 'NO ✗', text: 'The universe says not yet.', emoji: '🌑' },
    { r: 'YES ✓', text: 'Trust your intuition today.', emoji: '✨' },
    { r: 'MAYBE', text: 'The answer will reveal itself.', emoji: '🔮' },
    { r: 'YES ✓', text: 'A positive energy surrounds you.', emoji: '☀️' },
  ];

  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      if (card.classList.contains('flipped')) return;
      card.classList.add('flipped');
      const res = results[i % results.length];
      const back = card.querySelector('.card-back');
      if (back) {
        back.querySelector('.card-result').textContent = res.r;
        back.querySelector('.card-result-text').textContent = res.text;
      }
    });
  });

  const resetBtn = document.getElementById('reset-tarot');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('flipped'));
    });
  }
}

// ---- NUMEROLOGY CARDS ----
function initNumerologyCards() {
  const cards = document.querySelectorAll('.number-card');
  if (!cards.length) return;
  const modal = document.getElementById('num-modal');
  const modalTitle = document.getElementById('num-modal-title');
  const modalText = document.getElementById('num-modal-text');
  const modalClose = document.getElementById('num-modal-close');

  const meanings = {
    1: { title: 'Number 1 — The Leader', text: 'Number 1 represents independence, uniqueness, and new beginnings. It is associated with leadership, ambition, and originality. People with this number are pioneers who forge new paths.' },
    2: { title: 'Number 2 — The Peacemaker', text: 'Number 2 symbolizes balance, harmony, and cooperation. It governs partnerships, diplomacy, and intuition. This number is deeply sensitive and empathetic.' },
    3: { title: 'Number 3 — The Creator', text: 'Number 3 embodies creativity, self-expression, and joy. It is linked to art, communication, and social energy. Those under its influence are optimistic and inspiring.' },
    4: { title: 'Number 4 — The Builder', text: 'Number 4 stands for stability, discipline, and hard work. It is the foundation number, representing structure and reliability. It brings practicality into every endeavor.' },
    5: { title: 'Number 5 — The Adventurer', text: 'Number 5 represents freedom, change, and adventure. It is dynamic and versatile, craving variety and new experiences. This number is the explorer of the numerology chart.' },
    6: { title: 'Number 6 — The Nurturer', text: 'Number 6 governs love, family, and responsibility. It is the most harmonious of all numbers, often associated with healing and service to others.' },
    7: { title: 'Number 7 — The Seeker', text: 'Number 7 is the number of spiritual awakening and inner wisdom. It seeks truth, knowledge, and deeper understanding of the universe and its mysteries.' },
    8: { title: 'Number 8 — The Achiever', text: 'Number 8 symbolizes abundance, power, and material success. It is the number of achievement and authority, bringing great potential for prosperity.' },
    9: { title: 'Number 9 — The Humanitarian', text: 'Number 9 represents completion, compassion, and enlightenment. It is the number of universal love and the highest spiritual number, marking the end of a cycle.' }
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const num = card.dataset.num;
      const m = meanings[num];
      if (modal && m) {
        modalTitle.textContent = m.title;
        modalText.textContent = m.text;
        modal.classList.add('open');
      }
    });
  });

  if (modalClose) modalClose.addEventListener('click', () => modal.classList.remove('open'));
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}

// ---- ANGEL NUMBER TABS ----
function initAngelTabs() {
  const tabs = document.querySelectorAll('.angel-tab');
  const grid = document.getElementById('angel-grid');
  if (!tabs.length || !grid) return;

  const allNumbers = {
    single: [],
    double: [['00','11','22','33','44','55','66','77','88','99']],
    triple: [['111','222','333','444','555','666','777','888','999']],
    four: [['1111','2222','3333','4444','5555','6666','7777','8888','9999']]
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

// ---- ANGEL NUMBER CARD MODAL ----
function initAngelCards() {
  const cards = document.querySelectorAll('.angel-card');
  const modal = document.getElementById('angel-modal');
  const modalNum = document.getElementById('angel-modal-num');
  const modalText = document.getElementById('angel-modal-text');
  const modalClose = document.getElementById('angel-modal-close');

  if (!cards.length) return;

  const messages = {
    '00': 'You are at the beginning of a spiritual journey. The universe is asking you to reflect deeply on your purpose and trust in divine timing.',
    '11': 'Master Number 11 is a powerful spiritual gateway. Your intuition is heightened. Pay attention to your thoughts — they are manifesting rapidly.',
    '22': 'The Master Builder number. You have the ability to turn your biggest dreams into reality. Focus, and the universe will support your vision.',
    '33': 'The Master Teacher calls you to guide and inspire others. Your creativity and compassion are your greatest gifts to the world.',
    '44': 'You are surrounded by angelic protection and support. Hard work now will lead to lasting stability. Your foundations are being built.',
    '55': 'Major life changes are on the horizon. Embrace transformation — the angels are guiding you toward a better path.',
    '66': 'Focus on nurturing relationships and home life. Love, balance, and harmony are the messages your angels send you today.',
    '77': 'You are on the right path spiritually. Your angels are proud of your growth. Continue seeking wisdom and trust your inner knowing.',
    '88': 'Financial abundance and personal power are flowing to you. Stay aligned with your higher purpose and prosperity follows.',
    '99': 'A chapter of your life is completing. Release what no longer serves you and prepare for a new spiritual cycle to begin.',
    '111': 'A powerful manifestation portal is open. Your thoughts are seeds — plant only what you wish to grow in your life.',
    '222': 'Trust and patience are needed. Everything is unfolding in perfect divine order. Your faith will be rewarded.',
    '333': 'The Ascended Masters surround you with love and guidance. Your creative gifts are needed — share them with the world.',
    '444': 'You are fully supported by angels on all sides. This number is a reminder that you are never alone on your journey.',
    '555': 'Brace for transformation. The winds of change are blowing in your favor. Stay open and adaptable.',
    '666': 'Rebalance your thoughts. You may be overly focused on the material. Return to love, compassion, and spiritual values.',
    '777': 'Divine luck and synchronicity are flowing through your life. You are in perfect alignment with the universe.',
    '888': 'Abundance is flowing endlessly. Your past efforts are paying off. Prepare to receive on all levels — spiritually and materially.',
    '999': 'The universe calls you to complete your soul mission. Let go of the old to make room for a beautiful new beginning.',
    '1111': 'You are a lightworker. This powerful number signals your awakening. Stay present — your thoughts create your reality instantly.',
    '2222': 'Harmony and peace are yours to claim. The angels urge you to trust the process and maintain balance in all areas of life.',
    '3333': 'You are divinely guided and protected. Your prayers have been heard. The universe conspires in your favor.',
    '4444': 'Stability, hard work, and determination will bring you everything you seek. Your angels applaud your commitment.',
    '5555': 'The greatest transformation of your life is upon you. Welcome it with open arms — it leads to your highest good.',
    '6666': 'Reconnect with your heart. Love and compassion will guide you to the answers you seek in all areas of life.',
    '7777': 'You are vibrating at an extremely high spiritual frequency. Miracles and magical coincidences are everywhere around you.',
    '8888': 'Infinite abundance and success await you. The symbol of infinity amplified — your potential knows no bounds.',
    '9999': 'You have completed a major spiritual cycle. You stand at the threshold of your highest calling. Step boldly forward.',
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const num = card.dataset.num;
      if (modal) {
        modalNum.textContent = num;
        modalText.textContent = messages[num] || 'The angels have a special message for you. Trust your intuition and follow the guidance of your heart.';
        modal.classList.add('open');
      }
    });
  });

  if (modalClose) modalClose.addEventListener('click', () => modal.classList.remove('open'));
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}

// ---- ARCHANGEL CARDS ----
function initArchangelCards() {
  const cards = document.querySelectorAll('.archangel-card');
  const modal = document.getElementById('arch-modal');
  const modalTitle = document.getElementById('arch-modal-title');
  const modalBody = document.getElementById('arch-modal-body');
  const modalClose = document.getElementById('arch-modal-close');

  if (!cards.length) return;

  const archangels = {
    arreal: { name: 'Arreal Archangel', icon: '👼', text: 'Arreal is the angel of revelation and clarity. He illuminates the path forward and helps you see through confusion and illusion. Call upon Arreal when you need clear answers.' },
    uriel_s: { name: 'Uriel Selaphiel', icon: '🕯️', text: 'Uriel Selaphiel is the angel of wisdom and light. He brings the fire of God\'s truth and helps transform darkness into understanding. He is the patron of seekers of knowledge.' },
    gabriel: { name: 'Gabriel Archangel', icon: '📯', text: 'Gabriel is the messenger of God, delivering divine announcements and guiding communication. Call upon Gabriel for clarity in communication, creative inspiration, and major life changes.' },
    michael: { name: 'Michael Archangel', icon: '⚔️', text: 'Michael is the chief of the archangels, a warrior of divine light. He provides protection from all negative energies, cuts away fear, and brings courage to face any challenge.' },
    reguel: { name: 'Reguel Archangel', icon: '⚖️', text: 'Reguel is the angel of justice and fairness. He ensures harmony among the heavenly hosts and helps restore balance and fairness in earthly situations.' },
    uriel: { name: 'Uriel Archangel', icon: '🌟', text: 'Uriel is the angel of wisdom, creativity, and insight. He illuminates situations, provides prophetic information, and helps with problem-solving and intellectual pursuits.' },
    rafael: { name: 'Rafael Archangel', icon: '💚', text: 'Rafael is the divine healer. He oversees all forms of healing — physical, emotional, and spiritual. Call upon Rafael when you or a loved one needs healing energy and restoration.' },
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.angel;
      const info = archangels[key];
      if (modal && info) {
        modalTitle.innerHTML = info.icon + ' ' + info.name;
        modalBody.textContent = info.text;
        modal.classList.add('open');
      }
    });
  });

  if (modalClose) modalClose.addEventListener('click', () => modal.classList.remove('open'));
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}

// ---- ORB DOTS ----
function positionOrbDots() {
  const dots = document.querySelectorAll('.orb-dot');
  const positions = [
    { top: '5%', left: '50%' },
    { top: '50%', right: '5%' },
    { bottom: '5%', left: '50%' },
    { top: '50%', left: '5%' },
  ];
  dots.forEach((dot, i) => {
    if (positions[i]) {
      Object.assign(dot.style, positions[i]);
    }
  });
}

// ---- CURSOR GLOW ----
function initCursorGlow() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const glow = document.createElement('div');
  glow.style.cssText = `
    position:fixed; width:300px; height:300px; border-radius:50%;
    background:radial-gradient(circle, rgba(124,92,191,0.06) 0%, transparent 70%);
    pointer-events:none; z-index:0; transition:transform 0.15s ease;
    top:-150px; left:-150px;
  `;
  document.body.appendChild(glow);
  document.addEventListener('mousemove', e => {
    glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
}

// ---- INIT ALL ----
document.addEventListener('DOMContentLoaded', () => {
  createStarField();
  initScrollReveal();
  initNavbar();
  initParallax();
  positionOrbDots();
  initCursorGlow();
  initTarotCards();
  initNumerologyCards();
  initAngelCards();
  initArchangelCards();
  addSparkles(document.querySelector('.hero') || document.querySelector('.page-hero') || document.body);
});
