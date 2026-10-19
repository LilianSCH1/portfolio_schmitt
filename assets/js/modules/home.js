// Interactions propres à la page d'accueil : mot qui défile, heure locale, filtres de projets.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initRotator() {
  const el = document.querySelector('[data-rotate]');
  if (!el || reducedMotion.matches) {
    return;
  }

  const words = el.dataset.rotate.split(',').map((w) => w.trim());
  let index = 0;
  setInterval(() => {
    index = (index + 1) % words.length;
    el.classList.remove('is-swapping');
    void el.offsetWidth; // relance l'animation
    el.textContent = words[index];
    el.classList.add('is-swapping');
  }, 2200);
}

function initClock() {
  const el = document.querySelector('[data-clock]');
  if (!el) {
    return;
  }

  const format = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
  const tick = () => {
    el.textContent = format.format(new Date());
  };
  tick();
  setInterval(tick, 15000);
}

function initFilters() {
  const buttons = document.querySelectorAll('[data-filter]');
  const cards = document.querySelectorAll('[data-cat]');
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    const key = button.dataset.filter;
    const count = key === 'all' ? cards.length : [...cards].filter((c) => c.dataset.cat.includes(key)).length;
    const sup = document.createElement('sup');
    sup.textContent = count;
    button.appendChild(sup);

    button.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach((card) => {
        card.hidden = key !== 'all' && !card.dataset.cat.includes(key);
      });
    });
  });
}

export function initHome() {
  initRotator();
  initClock();
  initFilters();
}
