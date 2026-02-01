import * as renderer from './renderer.js';
import { attachToyUi, createToySettingsPanel } from './ui-wiring.js';

const DEV = location.hostname === 'localhost' || location.protocol === 'http:';

function assertSharedApiVersion(expected = '2.0') {
  const actual = window.ui && window.ui.SHARED_API_VERSION;
  if (!actual) {
    console.warn(`Shared UI API version not found; expected ${expected}.`);
    return;
  }
  if (actual !== expected) {
    const msg = `Shared UI API version mismatch: expected ${expected}, found ${actual}.`;
    console.warn(msg);
    if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast(msg, 'warning');
  }
}

function addExportButton() {
  const resetBtn = document.getElementById('reset-btn');
  if (!resetBtn) return;
  const exportBtn = document.createElement('button');
  exportBtn.id = 'export-btn';
  exportBtn.className = 'btn btn-xs btn-primary tooltip';
  exportBtn.setAttribute('data-tip', 'Export PNG');
  exportBtn.setAttribute('aria-label', 'Export');
  exportBtn.textContent = 'Export';
  resetBtn.parentNode.insertBefore(exportBtn, resetBtn);

  exportBtn.addEventListener('click', () => {
    window.ui?.showToast?.('Export not implemented yet', 'info');
  });
}

function wireFooterControls() {
  const statusEl = document.getElementById('pf-status');
  const speedReadout = document.getElementById('speed-readout');
  const speedButtons = document.querySelectorAll('[data-speed]');
  const playToggle = document.getElementById('pf-play-toggle');

  let speed = 1;
  let paused = true;

  function updateStatus() {
    const status = paused ? 'Paused' : 'Playing';
    if (speedReadout) speedReadout.textContent = `Speed: ${speed}x`;
    if (statusEl) statusEl.textContent = `Status: ${status}`;
  }

  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.speed);
      if (!isNaN(val)) speed = val;
      updateStatus();
      // TODO: apply speed to particle simulation logic
    });
  });

  if (playToggle) {
    playToggle.addEventListener('click', () => {
      paused = !paused;
      playToggle.textContent = paused ? 'Play' : 'Pause';
      updateStatus();
      // TODO: toggle particle update loop
    });
  }

  updateStatus();
}

document.addEventListener('DOMContentLoaded', async () => {
  assertSharedApiVersion('2.0');

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // 1) Header
  window.ui?.createHeader?.('Particle Fountain');

  // 2) Footer
  const footerHtml = `
    <div id="pf-controls">
      <button class="btn" data-speed="0.25">0.25x</button>
      <button class="btn" data-speed="0.5">0.5x</button>
      <button class="btn" data-speed="0.75">0.75x</button>
      <button class="btn" data-speed="1">1x</button>
      <button id="pf-play-toggle" class="btn">Play</button>
    </div>
    <div class="text-sm opacity-80 flex flex-wrap justify-center gap-4">
      <span id="speed-readout">Speed: 1x</span>
      <span id="pf-status">Status: Paused</span>
    </div>
  `;
  window.ui?.createFooter?.(footerHtml);

  // 3) Layout
  const unbindLayout = window.ui?.bindCanvasLayout?.(canvas, {
    onResize: () => {
      if (renderer.isInitialized && renderer.isInitialized()) {
        renderer.requestRender({ preview: false });
      }
    }
  });

  // 4) Renderer init
  await renderer.init({ ctx, uiTick: () => window.ui?.tickFrame?.(), settleMs: 120 });

  // 5) First render
  renderer.requestRender({ preview: false });

  // 6) Hide overlay
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';

  attachToyUi({
    onDemo: () => window.ui?.showToast?.('Demo mode not implemented yet', 'info'),
    onReset: () => window.ui?.showToast?.('Reset particle fountain', 'info'),
    onInfo: () => window.ui?.showInfo?.()
  });

  addExportButton();
  wireFooterControls();

  createToySettingsPanel({
    extraHtml: `
      <div class="mb-4">
        <label class="label font-semibold">Fountain Type</label>
        <select id="pf-fountain-type" class="select select-bordered w-full">
          <option value="confetti">Confetti</option>
          <option value="fireworks">Fireworks</option>
          <option value="aurora">Aurora</option>
        </select>
        <p class="text-xs opacity-70 mt-1">Choose a fountain style for the sky.</p>
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Emitter Heights</label>
        <label class="label text-sm">Low (5–15ft)</label>
        <input id="pf-height-low" type="range" min="5" max="15" value="10" class="range" />
        <label class="label text-sm mt-2">Mid (100–400ft)</label>
        <input id="pf-height-mid" type="range" min="100" max="400" value="220" class="range" />
        <label class="label text-sm mt-2">High (Stratosphere+)</label>
        <input id="pf-height-high" type="range" min="500" max="1200" value="900" class="range" />
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Particle Count</label>
        <input id="pf-particle-count" type="range" min="50" max="600" value="240" class="range" />
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Gravity</label>
        <input id="pf-gravity" type="range" min="0" max="2" step="0.05" value="0.6" class="range" />
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Wind Strength</label>
        <input id="pf-wind" type="range" min="0" max="2" step="0.05" value="0.4" class="range" />
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Color Palette</label>
        <select id="pf-palette" class="select select-bordered w-full">
          <option value="twilight">Twilight</option>
          <option value="ember">Ember</option>
          <option value="aurora">Aurora</option>
        </select>
      </div>

      <div class="mb-4 pf-type-section" data-type="confetti">
        <label class="label font-semibold">Confetti Spread</label>
        <input id="pf-confetti-spread" type="range" min="5" max="45" value="20" class="range" />
        <label class="label font-semibold mt-2">Paper Size</label>
        <input id="pf-confetti-size" type="range" min="1" max="8" value="4" class="range" />
      </div>

      <div class="mb-4 pf-type-section hidden" data-type="fireworks">
        <label class="label font-semibold">Burst Radius</label>
        <input id="pf-firework-radius" type="range" min="20" max="200" value="120" class="range" />
        <label class="label font-semibold mt-2">Trail Length</label>
        <input id="pf-firework-trail" type="range" min="10" max="120" value="60" class="range" />
        <label class="label font-semibold mt-2">Sparkle Density</label>
        <input id="pf-firework-density" type="range" min="0" max="1" step="0.05" value="0.6" class="range" />
      </div>

      <div class="mb-4 pf-type-section hidden" data-type="aurora">
        <label class="label font-semibold">Glow Intensity</label>
        <input id="pf-aurora-glow" type="range" min="0" max="1" step="0.05" value="0.7" class="range" />
        <label class="label font-semibold mt-2">Wave Speed</label>
        <input id="pf-aurora-wave" type="range" min="0" max="1" step="0.05" value="0.3" class="range" />
      </div>

      <p class="text-xs opacity-70">TODO: wire real particle parameters and palette.</p>
    `
  });

  const fountainSelect = document.getElementById('pf-fountain-type');
  const typeSections = Array.from(document.querySelectorAll('.pf-type-section'));
  function updateTypeSections(type) {
    typeSections.forEach(section => {
      section.classList.toggle('hidden', section.dataset.type !== type);
    });
  }
  if (fountainSelect) {
    updateTypeSections(fountainSelect.value);
    fountainSelect.addEventListener('change', (e) => updateTypeSections(e.target.value));
  }

  canvas.addEventListener('pointerdown', () => {
    // TODO: pointer interaction (drag to move fountain)
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // TODO: wheel interaction (zoom/scale)
  }, { passive: false });

  if (DEV) {
    window.__TEST__ = window.__TEST__ || {};
    window.__TEST__.getHeaderCount = () => document.querySelectorAll('.fixed.top-0').length;
    window.__TEST__.getFooterCount = () => document.querySelectorAll('.fixed.bottom-0').length;
    window.__TEST__.isRendererInitialized = () => renderer.isInitialized();
    window.__TEST__.getCanvasComputedStyle = () => getComputedStyle(canvas);
  }

  if (DEV) {
    try {
      const { runSelfTest } = await import('./tests/selftest.js');
      runSelfTest();
    } catch (err) {
      console.error('Self-test failed to run', err);
    }
  }

  window.addEventListener('beforeunload', () => {
    if (typeof unbindLayout === 'function') unbindLayout();
  });
});
