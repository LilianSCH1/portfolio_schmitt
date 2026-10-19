import { initCursor } from './modules/cursor.js';
import { initNavigation } from './modules/navigation.js';
import { initScrollReveal } from './modules/reveal.js';
import { initCopyButtons } from './modules/copy.js';
import { initHome } from './modules/home.js';
import { initPdfViewer } from './modules/pdf-viewer.js';
import { initTraceViewer } from './modules/trace-viewer.js';

document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initNavigation();
  initScrollReveal();
  initCopyButtons();
  initHome();
  initPdfViewer();
  initTraceViewer();
});
