// Courbes de niveau de la planche « Strates Lentes », dessinées dans .hero-grid-overlay.
const SVG_NS = 'http://www.w3.org/2000/svg';

// Petit générateur pseudo-aléatoire : même dessin à chaque visite d'une page donnée.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (const ch of text) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return h;
}

function contourPath(cx, cy, radius, phases, strength) {
  const points = [];
  for (let k = 0; k < 180; k++) {
    const t = (k / 180) * Math.PI * 2;
    const wobble =
      0.1 * Math.sin(2 * t + phases[0]) +
      0.06 * Math.sin(3 * t + phases[1]) +
      0.035 * Math.sin(5 * t + phases[2]) +
      0.02 * Math.sin(9 * t + phases[3]);
    const r = radius * (1 + wobble * strength);
    points.push(`${(cx + r * Math.cos(t) * 1.06).toFixed(1)},${(cy + r * Math.sin(t) * 0.94).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

export function initContours() {
  const hosts = document.querySelectorAll('.hero-grid-overlay');
  hosts.forEach((host) => {
    const random = seeded(hash(location.pathname || 'index'));
    const phases = Array.from({ length: 4 }, () => random() * Math.PI * 2);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 600 600');
    svg.setAttribute('aria-hidden', 'true');

    const count = 26;
    const highlight = 8 + Math.floor(random() * 10);
    for (let i = 0; i < count; i++) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', contourPath(300, 300, 8 + i * 11.5, phases, Math.min(1, i / 6)));
      path.setAttribute('fill', 'none');
      if (i === highlight) {
        path.setAttribute('stroke', '#c8b89a');
        path.setAttribute('stroke-width', '1.1');
        path.setAttribute('stroke-opacity', '0.85');
      } else {
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', i % 5 === 0 ? '0.9' : '0.55');
        path.setAttribute('stroke-opacity', (0.18 + 0.4 * (1 - i / count)).toFixed(2));
      }
      svg.appendChild(path);
    }

    const origin = document.createElementNS(SVG_NS, 'circle');
    origin.setAttribute('cx', '300');
    origin.setAttribute('cy', '300');
    origin.setAttribute('r', '3');
    origin.setAttribute('fill', '#d4553a');
    svg.appendChild(origin);

    host.replaceChildren(svg);
  });
}
