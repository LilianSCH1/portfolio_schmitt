export function initTraceViewer() {
  const modal = document.createElement('div');
  modal.className = 'trace-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="trace-modal-bar">
      <span class="trace-modal-label"></span>
      <button class="trace-modal-close" aria-label="Fermer">✕ Fermer</button>
    </div>
    <div class="trace-modal-body"></div>
  `;
  document.body.appendChild(modal);

  const labelEl = modal.querySelector('.trace-modal-label');
  const bodyEl = modal.querySelector('.trace-modal-body');
  const closeBtn = modal.querySelector('.trace-modal-close');

  function open(shot) {
    const img = shot.querySelector('img');
    const span = shot.querySelector('span');
    const p = shot.querySelector('p');

    labelEl.textContent = span ? span.textContent : '';

    bodyEl.innerHTML = '';

    if (img) {
      const image = document.createElement('img');
      image.src = img.src;
      image.alt = img.alt;
      image.className = 'trace-modal-img';
      bodyEl.appendChild(image);
    }

    if (p) {
      const desc = document.createElement('p');
      desc.className = 'trace-modal-desc';
      desc.textContent = p.textContent;
      bodyEl.appendChild(desc);
    }

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === bodyEl) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  document.addEventListener('click', (e) => {
    const shot = e.target.closest('.project-shot.has-image');
    if (!shot) return;
    if (e.target.closest('a')) return;
    open(shot);
  });
}
