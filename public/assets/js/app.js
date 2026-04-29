import { initCustomCursor } from './modules/cursor.js';
import { initScrollReveal } from './modules/reveal.js';

function wrapTextWithLetters(element, letterClass = 'nav-letter') {
  if (element.dataset.ledReady === 'true') {
    return;
  }

  const originalText = element.textContent ?? '';
  element.dataset.ledReady = 'true';
  element.setAttribute('aria-label', originalText.trim());

  const fragment = document.createDocumentFragment();

  for (const character of Array.from(originalText)) {
    if (character === ' ' || character === '\n' || character === '\t') {
      fragment.appendChild(document.createTextNode(character));
      continue;
    }

    const letter = document.createElement('span');
    letter.className = letterClass;
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = character;
    fragment.appendChild(letter);
  }

  element.textContent = '';
  element.appendChild(fragment);
}

function initHeaderLedAnimation() {
  const targets = document.querySelectorAll('.nav-logo, .nav-links a');
  const letters = [];

  targets.forEach((element) => {
    wrapTextWithLetters(element, 'nav-letter');
    element.querySelectorAll('.nav-letter').forEach((letter) => letters.push(letter));
  });

  if (!letters.length) {
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  
  if (reducedMotion.matches) {
    return;
  }

  const interval = 160;
  const totalCycleDuration = letters.length * interval;
  const firstPassDelay = 0;
  const secondPassDelay = totalCycleDuration / 3;
  const thirdPassDelay = (2 * totalCycleDuration) / 3;

  let activeIndices = new Set();

  const updateActiveletters = () => {
    letters.forEach((letter, index) => {
      letter.classList.toggle('is-active', activeIndices.has(index));
    });
  };

  const createPassAnimator = (startDelay) => {
    setTimeout(() => {
      let activeIndex = 0;
      const setActiveLetter = () => {
        activeIndices.delete((activeIndex - 1 + letters.length) % letters.length);
        activeIndices.add(activeIndex);
        updateActiveletters();

        activeIndex = (activeIndex + 1) % letters.length;
      };

      setActiveLetter();
      window.setInterval(setActiveLetter, interval);
    }, startDelay);
  };

  createPassAnimator(firstPassDelay);
  createPassAnimator(secondPassDelay);
  createPassAnimator(thirdPassDelay);
}

document.addEventListener('DOMContentLoaded', () => {
  initCustomCursor();
  initScrollReveal();
  initHeaderLedAnimation();
});
