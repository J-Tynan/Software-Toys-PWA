import * as renderer from './renderer.js';

// Test PWA main orchestration
document.addEventListener('DOMContentLoaded', async () => {
  // Validate shared UI API version
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
  assertSharedApiVersion('2.0');

  // Create header via shared UI
  const header = window.ui && typeof window.ui.createHeader === 'function'
    ? window.ui.createHeader('Test PWA')
    : null;

  // Wire header buttons to sensible defaults (demo, reset, info)
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) demoBtn.addEventListener('click', () => {
    if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Demo mode not implemented in Test PWA', 'info');
  });

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderer.requestRender({ width: canvas.width, height: canvas.height });
      if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Reset', 'info');
    }
  });

  const infoBtn = document.getElementById('info-btn');
  if (infoBtn) infoBtn.addEventListener('click', () => {
    if (window.ui && typeof window.ui.showInfo === 'function') window.ui.showInfo();
  });


  // Apply shared theme (reads from localStorage, etc.)
  if (typeof utils !== 'undefined' && typeof utils.applyGlobalTheme === 'function') utils.applyGlobalTheme();

  // Create a simple two-row footer via shared UI control panel, fallback to manual if missing
  let footer = null;
  const controlHtml = `
    <div id="footer-controls">
      <button id="btn-test-1" class="btn">Test 1</button>
      <button id="btn-test-2" class="btn">Test 2</button>
      <button id="btn-info" class="btn">Info</button>
      <button id="btn-settings" class="btn">Settings</button>
    </div>
    <div id="footer-status" class="text-sm opacity-80">Status: idle <span id="test-status"></span></div>
  `;

  if (window.ui && typeof window.ui.createControlPanel === 'function') {
    footer = window.ui.createControlPanel(controlHtml);
  } else {
    // fallback to manual footer if shared helper is not present
    footer = document.getElementById('test-footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.id = 'test-footer';
      footer.className = 'fixed bottom-0 left-0 right-0 bg-base-200 shadow-md';
      footer.innerHTML = controlHtml;
      document.body.appendChild(footer);
    } else {
      const content = footer.querySelector('.control-content');
      if (content) content.innerHTML = controlHtml;
    }
  }

  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas element missing');
    return;
  }
  const ctx = canvas.getContext('2d', { alpha: false });

  function updateCanvasLayout() {
    const headerEl = document.querySelector('.fixed.top-0');
    const footerEl = document.querySelector('.fixed.bottom-0') || document.getElementById('test-footer');
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
    const footerHeight = footerEl ? Math.round(footerEl.getBoundingClientRect().height) : 0;

    document.body.style.setProperty('--header-height', headerHeight + 'px');
    document.body.style.setProperty('--footer-height', footerHeight + 'px');

    canvas.style.top = headerHeight + 'px';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = Math.max(1, window.innerHeight - headerHeight - footerHeight) + 'px';
    canvas.style.bottom = '';

    canvas.width = Math.max(1, canvas.clientWidth);
    canvas.height = Math.max(1, canvas.clientHeight);
  }

  window.addEventListener('resize', updateCanvasLayout);
  updateCanvasLayout();

  // Initialize renderer
  await renderer.init({ ctx, uiTick: () => {}, settleMs: 100 });
  renderer.requestRender({ width: canvas.width, height: canvas.height, preview: false });

  // Wire footer buttons
  document.getElementById('btn-test-1').addEventListener('click', () => {
    document.getElementById('test-status').textContent = 'Button 1 clicked';
    if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Test 1 clicked', 'info');
  });
  document.getElementById('btn-test-2').addEventListener('click', () => {
    document.getElementById('test-status').textContent = 'Button 2 clicked';
    if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Test 2 clicked', 'info');
  });

  document.getElementById('btn-info').addEventListener('click', () => {
    if (window.ui && typeof window.ui.showInfo === 'function') window.ui.showInfo();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    if (!window.ui || typeof window.ui.createSettingsPanel !== 'function') {
      console.warn('Shared settings panel not available');
      return;
    }
    let panel = window.ui.createSettingsPanel({ extraTopHtml: `
      <div class="mb-3">
        <label class="label">Test Button</label>
        <button id="settings-test-btn" class="btn btn-xs">Run</button>
      </div>
    ` });
    if (panel && !document.body.contains(panel)) document.body.appendChild(panel);
    panel.classList.remove('hidden');

    // Wire test button inside settings
    const settingsBtn = panel.querySelector('#settings-test-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
      const status = document.getElementById('test-status');
      if (status) status.textContent = 'Settings test ran';
      if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Settings test ran', 'success');
    });
  });

  // Expose test hooks
  window.__TEST__ = window.__TEST__ || {};
  window.__TEST__.getHeaderCount = () => document.querySelectorAll('.fixed.top-0').length;
  window.__TEST__.getFooterCount = () => document.querySelectorAll('.fixed.bottom-0').length + (document.getElementById('test-footer') ? 1 : 0);
  window.__TEST__.isRendererInitialized = () => renderer && !!renderer.isInitialized;
  window.__TEST__.getCanvasComputedStyle = () => getComputedStyle(canvas);

  // Run dev self-test
  if (true) { // always run for Test-PWA
    try {
      const { runSelfTest } = await import('./tests/selftest.js');
      const result = await runSelfTest();
      window.__TEST__.selfTestResult = result;
      if (result.ok) {
        if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Test PWA self-test passed', 'success');
      } else {
        if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast('Test PWA self-test failed', 'error');
      }
    } catch (err) {
      console.error('Self-test failed to run', err);
    }
  }
});
