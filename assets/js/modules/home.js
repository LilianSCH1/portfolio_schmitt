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

// Lettres du nom : chaque lettre roule vers une copie orange au survol.
function initLetters() {
  const lines = document.querySelectorAll('.hero-name .line > span');
  if (!lines.length) {
    return;
  }

  const chars = [];
  lines.forEach((line) => {
    [...line.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) {
        return;
      }
      const fragment = document.createDocumentFragment();
      for (const letter of node.textContent.trim()) {
        const char = document.createElement('span');
        char.className = 'char';
        char.setAttribute('aria-hidden', 'true');
        char.innerHTML = `<span class="char-roll"><span>${letter}</span><span class="char-alt">${letter}</span></span>`;
        fragment.appendChild(char);
        chars.push(char);
      }
      node.replaceWith(fragment);
    });
  });

  chars.forEach((char) => {
    let timer = 0;
    char.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      char.classList.add('is-on');
    });
    char.addEventListener('mouseleave', () => {
      timer = setTimeout(() => char.classList.remove('is-on'), 260);
    });
  });

  if (reducedMotion) {
    return;
  }

  // Vague de couleur sur toutes les lettres
  const wave = () => {
    chars.forEach((char, i) => {
      setTimeout(() => {
        char.classList.add('is-on');
        setTimeout(() => char.classList.remove('is-on'), 520);
      }, i * 55);
    });
  };
  setTimeout(wave, 1300);

  // Sans survol possible (écran tactile), la vague repasse régulièrement
  if (window.matchMedia('(hover: none)').matches) {
    setInterval(wave, 7000);
  }
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
  initLetters();
  initTyped();
  initPreview();
  initClock();
}
