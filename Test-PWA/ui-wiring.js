export function attachToyUi({ onDemo, onReset, onInfo } = {}) {
  document.getElementById('demo-btn')?.addEventListener('click', () => onDemo && onDemo());
  document.getElementById('reset-btn')?.addEventListener('click', () => onReset && onReset());
  document.getElementById('info-btn')?.addEventListener('click', () => onInfo && onInfo());
}

export function createToySettingsPanel({ extraHtml = '' } = {}) {
  return window.ui?.createSettingsPanel?.({
    showFractalSelection: false,
    extraHtml
  });
}
