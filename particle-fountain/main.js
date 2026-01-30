import * as renderer from './renderer.js';
import { attachToyUi, createToySettingsPanel } from './ui-wiring.js';

// Minimal startup wiring for Particle Fountain
// TODO: Implement full particle logic in renderer/worker and visualizations

document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved theme if present
  if (window.utils && typeof window.utils.loadGlobalTheme === 'function') window.utils.loadGlobalTheme();

  // Sanity: check shared UI API version (bumped to 2.0)
  if (!window.ui || window.ui.SHARED_API_VERSION !== '2.0') {
    const msg = `Shared UI API version mismatch (expected 2.0). Some features may not work.`;
    console.warn(msg);
    if (window.ui && typeof window.ui.showToast === 'function') window.ui.showToast(msg, 'warning');
  }

  // 1) Create header and footer
  if (window.ui && typeof window.ui.createHeader === 'function') window.ui.createHeader('Particle Fountain');
  if (window.ui && typeof window.ui.createZoomFooter === 'function') window.ui.createZoomFooter({ onZoomIn: () => { /* TODO: wire */ }, onZoomOut: () => { /* TODO: wire */ } });

  // Wire toy-specific header buttons (Demo, Reset, Info) — no Save/Load per request
  attachToyUi({
    onDemo: () => { if (window.ui && window.ui.showToast) window.ui.showToast('Demo: TODO', 'info'); },
    onReset: () => { if (window.ui && window.ui.showToast) window.ui.showToast('Reset: TODO', 'info'); },
    onInfo: () => { if (window.ui && window.ui.createInfoModal) window.ui.createInfoModal('<p>Particle Fountain — TODO: add documentation.</p>', 'Particle Fountain'); }
  });

  // 2) Layout helper
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  function updateCanvasLayout() {
    const headerEl = document.querySelector('.fixed.top-0');
    const footerEl = document.querySelector('.fixed.bottom-0');
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
    const footerHeight = footerEl ? Math.round(footerEl.getBoundingClientRect().height) : 0;
    document.body.style.setProperty('--header-height', headerHeight + 'px');
    document.body.style.setProperty('--footer-height', footerHeight + 'px');

    const top = headerHeight;
    const visibleHeight = Math.max(1, window.innerHeight - headerHeight - footerHeight);
    canvas.style.top = top + 'px';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = visibleHeight + 'px';
    canvas.width = Math.max(1, canvas.clientWidth);
    canvas.height = Math.max(1, canvas.clientHeight);
  }
  updateCanvasLayout();
  window.addEventListener('resize', updateCanvasLayout);

  // 3) Initialize renderer
  await renderer.init({ ctx, uiTick: () => (window.ui && window.ui.tickFrame && window.ui.tickFrame()), settleMs: 140 });

  // 4) First full render
  renderer.requestRender({ preview: false });

  // 5) Hide loading overlay and enable UI
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';

  // 6) Basic pointer & wheel wiring (attach handlers to canvas only)
  let interactionPending = false;
  canvas.addEventListener('pointerdown', (e) => { interactionPending = true; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!interactionPending) return; renderer.requestRender({ preview: true }); });
  function endInteraction() { if (!interactionPending) return; interactionPending = false; renderer.scheduleFullResRender(); }
  canvas.addEventListener('pointerup', endInteraction);
  canvas.addEventListener('pointercancel', endInteraction);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); renderer.requestRender({ preview: true }); renderer.scheduleFullResRender(); }, { passive: false });

  // 7) Expose simple DEV-only self-test and window.__TEST__ hooks
  if (location.hostname === 'localhost' || location.protocol === 'http:') {
    window.__TEST__ = window.__TEST__ || {};
    window.__TEST__.getHeaderCount = () => document.querySelectorAll('.fixed.top-0').length;
    window.__TEST__.getFooterCount = () => document.querySelectorAll('.fixed.bottom-0').length;
    window.__TEST__.isRendererInitialized = () => renderer.isInitialized && renderer.isInitialized();
    window.__TEST__.getCanvasComputedStyle = () => {
      const cs = getComputedStyle(canvas);
      return { position: cs.position, width: cs.width, height: cs.height };
    };
  } else {
    window.__TEST__ = window.__TEST__ || {};
    window.__TEST__.getHeaderCount = () => 0;
    window.__TEST__.getFooterCount = () => 0;
    window.__TEST__.isRendererInitialized = () => false;
    window.__TEST__.getCanvasComputedStyle = () => null;
  }

  // 8) Dev self-test (non-blocking): basic startup checks
  try {
    const headerCount = window.__TEST__.getHeaderCount();
    const footerCount = window.__TEST__.getFooterCount();
    if (headerCount !== 1 || footerCount < 0) {
      if (window.ui && window.ui.showToast) window.ui.showToast('Startup self-test warning: header/footer count unexpected', 'warning');
    }
    if (!window.__TEST__.isRendererInitialized()) {
      if (window.ui && window.ui.showToast) window.ui.showToast('Renderer not initialized', 'warning');
    }
  } catch (e) {
    console.warn('Self-test failed', e);
  }
});
