export function initPdfViewer() {
  const modal = document.createElement('div');
  modal.className = 'pdf-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Visionneuse PDF');
  modal.innerHTML = `
    <div class="pdf-modal-bar">
      <span class="pdf-modal-title"></span>
      <div class="pdf-modal-actions">
        <a class="pdf-modal-newtab" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>
        <button class="pdf-modal-close">✕ Fermer</button>
      </div>
    </div>
    <div class="pdf-modal-body">
      <iframe title="Visionneuse PDF" allowfullscreen></iframe>
    </div>
  `;
  document.body.appendChild(modal);

  const titleEl = modal.querySelector('.pdf-modal-title');
  const iframeEl = modal.querySelector('iframe');
  const newTabEl = modal.querySelector('.pdf-modal-newtab');
  const closeBtn = modal.querySelector('.pdf-modal-close');

  function open(href, label) {
    titleEl.textContent = label;
    iframeEl.src = href;
    newTabEl.href = href;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { iframeEl.src = ''; }, 280);
  }

  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href$=".pdf"]');
    if (!link) return;
    e.preventDefault();
    const label = link.textContent.trim() || link.href.split('/').pop();
    open(link.href, label);
  });
}
