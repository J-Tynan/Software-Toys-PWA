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

function runSelfTest() {
  const errors = [];
  if (document.querySelectorAll('.fixed.top-0').length !== 1) errors.push('Expected exactly one header.');
  if (document.querySelectorAll('.fixed.bottom-0').length !== 1) errors.push('Expected exactly one footer.');
  const canvas = document.getElementById('canvas');
  if (!canvas) errors.push('Canvas element missing.');
  else if (getComputedStyle(canvas).position !== 'absolute') errors.push('Canvas must be absolutely positioned.');
  if (!document.body.style.getPropertyValue('--header-height')) errors.push('Missing --header-height CSS variable.');
  if (!document.body.style.getPropertyValue('--footer-height')) errors.push('Missing --footer-height CSS variable.');
  if (!renderer.isInitialized || !renderer.isInitialized()) errors.push('Renderer not initialized.');

  if (errors.length) {
    console.error('[Test PWA] Self-test failed:', errors);
    window.ui?.showToast?.('Self-test failed. Check console.', 'warning');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  assertSharedApiVersion('2.0');

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  window.ui?.createHeader?.('Test PWA');

  const footerHtml = `
    <div id="test-controls">
      <button class="btn">Row 1</button>
      <button class="btn">Buttons</button>
    </div>
    <div id="test-status" class="text-sm opacity-80">Footer row 2 for layout validation</div>
  `;
  window.ui?.createFooter?.(footerHtml);

  const unbindLayout = window.ui?.bindCanvasLayout?.(canvas, {
    onResize: () => {
      if (renderer.isInitialized && renderer.isInitialized()) {
        renderer.requestRender({ preview: false });
      }
    }
  });

  await renderer.init({ ctx, uiTick: () => window.ui?.tickFrame?.(), settleMs: 120 });
  renderer.requestRender({ preview: false });

  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';

  attachToyUi({
    onDemo: () => window.ui?.showToast?.('Demo mode not implemented yet', 'info'),
    onReset: () => window.ui?.showToast?.('Reset test PWA', 'info'),
    onInfo: () => window.ui?.showInfo?.()
  });

  createToySettingsPanel({
    extraHtml: `
      <div class="mb-3">
        <label class="label">Test Setting</label>
        <input type="range" min="0" max="100" value="50" class="range" />
      </div>
    `
  });

  canvas.addEventListener('pointerdown', () => {
    // noop for test
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
  }, { passive: false });

  if (DEV) {
    window.__TEST__ = window.__TEST__ || {};
    window.__TEST__.getHeaderCount = () => document.querySelectorAll('.fixed.top-0').length;
    window.__TEST__.getFooterCount = () => document.querySelectorAll('.fixed.bottom-0').length;
    window.__TEST__.isRendererInitialized = () => renderer.isInitialized();
    window.__TEST__.getCanvasComputedStyle = () => getComputedStyle(canvas);
  }

  if (DEV) runSelfTest();

  window.addEventListener('beforeunload', () => {
    if (typeof unbindLayout === 'function') unbindLayout();
  });
});
