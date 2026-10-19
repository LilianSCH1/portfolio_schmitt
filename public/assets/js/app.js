import { initContours } from './modules/contours.js';
import { initNavigation } from './modules/navigation.js';
import { initScrollReveal } from './modules/reveal.js';
import { initCopyButtons } from './modules/copy.js';
import { initPdfViewer } from './modules/pdf-viewer.js';
import { initTraceViewer } from './modules/trace-viewer.js';

document.addEventListener('DOMContentLoaded', () => {
  initContours();
  initNavigation();
  initScrollReveal();
  initCopyButtons();
  initPdfViewer();
  initTraceViewer();
});
