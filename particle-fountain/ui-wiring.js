// Thin adapter to wire Particle Fountain callbacks into the shared header and settings
// NOTE: per-request, this scaffolding does NOT add Save/Load buttons.

export function attachToyUi({ onDemo = null, onReset = null, onInfo = null } = {}) {
  // Demo button
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn && typeof onDemo === 'function') demoBtn.addEventListener('click', onDemo);

  // Reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn && typeof onReset === 'function') resetBtn.addEventListener('click', onReset);

  // Info button
  const infoBtn = document.getElementById('info-btn');
  if (infoBtn && typeof onInfo === 'function') infoBtn.addEventListener('click', onInfo);

  // If header elements aren't present, do not throw — graceful fallback
}

export function createToySettingsPanel(opts = {}) {
  // Provide an extraHtml area where the toy can inject local controls
  const extraHtml = opts.extraHtml || `
    <div class="py-2">
      <!-- TODO: Add Particle Fountain-specific settings (spawn rate, gravity, color) -->
      <label class="flex items-center gap-2"><input id="pf-spawn-toggle" type="checkbox" class="checkbox" /> Auto spawn</label>
    </div>
  `;

  if (window.ui && typeof window.ui.createSettingsPanel === 'function') {
    window.ui.createSettingsPanel(Object.assign({}, opts, { extraHtml }));
  } else {
    console.warn('createSettingsPanel not available on shared UI');
  }
}
