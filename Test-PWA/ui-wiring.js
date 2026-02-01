// Optional helper to attach toy UI handlers to shared header/footer
export function attachToyUi({ onDemo, onReset, onInfo }) {
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn && typeof onDemo === 'function') demoBtn.addEventListener('click', onDemo);

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn && typeof onReset === 'function') resetBtn.addEventListener('click', onReset);

  const infoBtn = document.getElementById('info-btn');
  if (infoBtn && typeof onInfo === 'function') infoBtn.addEventListener('click', onInfo);
}
