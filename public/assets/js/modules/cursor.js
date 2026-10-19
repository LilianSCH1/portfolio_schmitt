// Curseur personnalisé : un point précis et un anneau qui suit avec retard.
export function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const label = document.createElement('span');
  label.className = 'cursor-label';
  ring.appendChild(label);
  [dot, ring].forEach((el) => {
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  });
  document.documentElement.classList.add('has-cursor');

  const lag = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0.18;
  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;

  const render = () => {
    rx += (x - rx) * lag;
    ry += (y - ry) * lag;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  document.addEventListener('mousemove', (e) => {
    x = e.clientX;
    y = e.clientY;
    document.documentElement.classList.remove('cursor-hidden');
  });
  document.addEventListener('mouseleave', () => document.documentElement.classList.add('cursor-hidden'));
  document.addEventListener('mousedown', () => document.documentElement.classList.add('cursor-down'));
  document.addEventListener('mouseup', () => document.documentElement.classList.remove('cursor-down'));

  // Anneau agrandi sur les éléments cliquables, avec un libellé si data-cursor est fourni
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('a, button, [data-cursor], .char');
    const root = document.documentElement;
    root.classList.toggle('cursor-hover', Boolean(target));
    const text = target?.closest('[data-cursor]')?.dataset.cursor ?? '';
    label.textContent = text;
    root.classList.toggle('cursor-text', Boolean(text));
  });
}
