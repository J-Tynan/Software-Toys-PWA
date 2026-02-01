export function attachToyUi({ onDemo, onReset, onInfo } = {}) {
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) demoBtn.addEventListener('click', () => onDemo && onDemo());

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => onReset && onReset());

  const infoBtn = document.getElementById('info-btn');
  if (infoBtn) infoBtn.addEventListener('click', () => onInfo && onInfo());
}

export function createToySettingsPanel({ extraHtml = '' } = {}) {
  if (!window.ui || typeof window.ui.createSettingsPanel !== 'function') return null;
  return window.ui.createSettingsPanel({
    extraHtml,
    showFractalSelection: false
  });
}
