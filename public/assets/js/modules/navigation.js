export function initNavigation() {
  const nav = document.querySelector('nav:not(.comp-nav)');
  const list = nav?.querySelector('.nav-links');
  if (!nav || !list) {
    return;
  }

  // Bouton « Menu » pour les petits écrans
  if (!list.id) {
    list.id = 'nav-links';
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.textContent = 'Menu';
  toggle.setAttribute('aria-controls', list.id);
  toggle.setAttribute('aria-expanded', 'false');
  nav.appendChild(toggle);

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Fermer' : 'Menu';
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Lien de la section visible mis en évidence
  const links = new Map();
  list.querySelectorAll('a[href^="#"]').forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) links.set(section, link);
  });
  if (!links.size) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove('is-current'));
        links.get(entry.target).classList.add('is-current');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  links.forEach((_, section) => observer.observe(section));
}
