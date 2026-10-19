// Interactions de l'accueil : texte tapé, aperçu d'image au survol, heure locale.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initTyped() {
  const el = document.querySelector('[data-typed]');
  if (!el || reducedMotion) {
    return;
  }

  const phrases = el.dataset.typed.split('|');
  let phrase = 0;
  let length = phrases[0].length;
  let deleting = true;
  el.textContent = phrases[0];

  const step = () => {
    const text = phrases[phrase];
    length += deleting ? -1 : 1;
    el.textContent = text.slice(0, length);

    let delay = deleting ? 28 : 55;
    if (!deleting && length === text.length) {
      deleting = true;
      delay = 2400;
    } else if (deleting && length === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      delay = 300;
    }
    setTimeout(step, delay);
  };
  setTimeout(step, 2600);
}

function initPreview() {
  const rows = document.querySelectorAll('[data-preview]');
  if (!rows.length || window.matchMedia('(hover: none)').matches) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'preview';
  box.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.alt = '';
  box.appendChild(img);
  document.body.appendChild(box);

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let raf = 0;
  const follow = () => {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    box.style.left = `${cx}px`;
    box.style.top = `${cy}px`;
    raf = requestAnimationFrame(follow);
  };

  rows.forEach((row) => {
    row.classList.add('has-preview');
    row.addEventListener('mouseenter', (e) => {
      img.src = row.dataset.preview;
      cx = x = e.clientX;
      cy = y = e.clientY;
      box.classList.add('is-on');
      cancelAnimationFrame(raf);
      follow();
    });
    row.addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
    });
    row.addEventListener('mouseleave', () => {
      box.classList.remove('is-on');
      cancelAnimationFrame(raf);
    });
  });
}

function initClock() {
  const el = document.querySelector('[data-clock]');
  if (!el) {
    return;
  }

  const format = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  const tick = () => {
    el.textContent = format.format(new Date());
  };
  tick();
  setInterval(tick, 15000);
}

export function initHome() {
  initTyped();
  initPreview();
  initClock();
}
