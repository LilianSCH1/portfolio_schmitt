export function initCustomCursor() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');

  if (!dot || !ring) {
    return;
  }

  // Disable custom cursor on touch-first devices.
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
    dot.style.display = 'none';
    ring.style.display = 'none';
    document.body.style.cursor = 'auto';
    return;
  }

  document.addEventListener('mousemove', (event) => {
    const { clientX, clientY } = event;
    dot.style.left = clientX + 'px';
    dot.style.top = clientY + 'px';
    ring.style.left = clientX + 'px';
    ring.style.top = clientY + 'px';
  });

  const hoverEls = document.querySelectorAll('a, button, .case-study, .skill-tag, .nav-logo');
  hoverEls.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}
