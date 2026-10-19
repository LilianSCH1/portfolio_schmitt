export function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copié';
      } catch {
        button.textContent = 'Échec';
      }
      button.classList.add('is-done');
      setTimeout(() => {
        button.textContent = label;
        button.classList.remove('is-done');
      }, 1800);
    });
  });
}
