// Shared UI functions using DaisyUI classes
// ------------------------------------------------------------
// This file provides reusable UI primitives for all software toys.
// Toys opt-in to features they need (header UI, footer UI, settings panel).
// No toy-specific logic lives here.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Top Header Bar
// ------------------------------------------------------------
function createHeader(title) {
  console.debug('createHeader called with title:', title);
  // Idempotent: return existing header if present
  let existing = document.getElementById('fe-header');
  if (existing) { console.debug('createHeader: returning existing header'); return existing; }

  const header = document.createElement('div');
  header.id = 'fe-header';
  header.className =
    'fixed top-0 left-0 right-0 z-20 bg-base-100 shadow-md h-12 min-h-12 max-h-12';

  header.innerHTML = `
    <div class="grid grid-cols-[auto_1fr_auto] items-center h-full px-2">

      <!-- LEFT -->
      <div class="flex items-center gap-2 flex-nowrap max-w-[40vw] overflow-hidden">
        <button id="home-btn" class="btn btn-xs btn-ghost tooltip" data-tip="Home">
          Home
        </button>
        <button id="demo-btn" class="btn btn-xs btn-primary tooltip" data-tip="Demo Mode">
          Demo
        </button>
      </div>

      <!-- CENTER -->
      <div class="flex justify-center pointer-events-none">
        <span class="text-lg font-bold truncate">
          ${title}
        </span>
      </div>

      <!-- RIGHT -->
      <div class="flex items-center gap-1 flex-nowrap flex-shrink-0">
        <button id="reset-btn" class="btn btn-xs btn-secondary tooltip" data-tip="Reset">
          Reset
        </button>

        <button id="fullscreen-btn" class="btn btn-xs btn-ghost tooltip" data-tip="Fullscreen">
          ⛶
        </button>

        <button id="info-btn" class="btn btn-xs btn-ghost tooltip" data-tip="Info">
          ?
        </button>

        <label class="swap swap-rotate tooltip flex items-center" data-tip="Theme">
          <input type="checkbox" id="theme-toggle" />
          <div class="swap-on">🌙</div>
          <div class="swap-off">☀️</div>
        </label>

        <button id="settings-btn" class="btn btn-xs btn-ghost tooltip" data-tip="Settings">
          ⚙️
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(header);

  // Expose header height as a CSS var for toys that prefer CSS-driven layout
  function updateHeaderHeightCSS() {
    const rect = header.getBoundingClientRect();
    document.body.style.setProperty('--header-height', Math.round(rect.height) + 'px');
  }
  updateHeaderHeightCSS();
  window.addEventListener('resize', updateHeaderHeightCSS);

  // Smart tooltip positioning
  function setTooltipDirections() {
    const tooltips = header.querySelectorAll('.tooltip');
    tooltips.forEach(el => {
      el.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-top', 'tooltip-bottom');
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceLeft = rect.left;
      const spaceRight = vw - rect.right;
      const spaceTop = rect.top;
      const spaceBottom = vh - rect.bottom;

      if (spaceRight < 100) el.classList.add('tooltip-left');
      else if (spaceLeft < 100) el.classList.add('tooltip-right');
      else if (spaceBottom < 60) el.classList.add('tooltip-top');
      else el.classList.add('tooltip-bottom');
    });
  }

  setTimeout(setTooltipDirections, 0);
  window.addEventListener('resize', setTooltipDirections);

  // Theme toggle: initialize from saved settings and sync with system preference
  const themeToggle = document.getElementById('theme-toggle');
  const headerMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function initHeaderThemeToggle() {
    const systemOn = utils.isSystemThemeEnabled();
    if (!themeToggle) return;
    if (systemOn) {
      // Follow system preference (disable manual toggle)
      themeToggle.checked = headerMediaQuery.matches;
      themeToggle.disabled = true;
    } else {
      themeToggle.checked = utils.getGlobalTheme() === 'luxury';
      themeToggle.disabled = false;
    }
  }

  if (themeToggle) initHeaderThemeToggle();

  // If system preference changes and system-follow is enabled, update UI
  headerMediaQuery.addEventListener('change', () => {
    if (utils.isSystemThemeEnabled()) {
      if (themeToggle) themeToggle.checked = headerMediaQuery.matches;
      document.documentElement.setAttribute('data-theme', headerMediaQuery.matches ? 'luxury' : 'emerald');
    }
  });

  if (themeToggle) themeToggle.addEventListener('change', e => {
    // When user manually toggles theme, turn off system-follow and persist choice
    localStorage.setItem('systemThemeEnabled', 'false');
    const settingsSystemToggle = document.getElementById('global-system-theme-toggle');
    if (settingsSystemToggle) settingsSystemToggle.checked = false;

    document.documentElement.setAttribute('data-theme', e.target.checked ? 'luxury' : 'emerald');
    localStorage.setItem('globalTheme', e.target.checked ? 'luxury' : 'emerald');

    // Ensure toggle remains enabled
    themeToggle.disabled = false;
    setTimeout(setTooltipDirections, 100);
  });

  // Listen for cross-window changes to theme settings
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'systemThemeEnabled' || ev.key === 'globalTheme') {
      initHeaderThemeToggle();
      utils.applyGlobalTheme();
    }
  });

  // Also listen for the custom theme-change event and update header UI
  window.addEventListener('global-theme-changed', (e) => {
    initHeaderThemeToggle();
  });

  // Sound toggle (header control removed) — guard listener in case element exists
  const headerSoundToggle = document.getElementById('sound-toggle');
  if (headerSoundToggle) headerSoundToggle.addEventListener('change', e => {
    utils.toggleSound(e.target.checked);
  });

  // Fullscreen
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });

  // Info button opens a modal. If a modal hasn't been created by the toy,
  // we create a default one on-demand so the UI layer stays simple and the
  // toy can opt-in to provide rich HTML content by calling `ui.createInfoModal(...)`.
  const infoBtn = document.getElementById('info-btn');
  if (infoBtn) infoBtn.addEventListener('click', () => {
    let modal = document.getElementById('info-modal');
    if (!modal) modal = createInfoModal(); // create with sensible default
    if (!document.body.contains(modal)) document.body.appendChild(modal);
    modal.showModal();
  });

  // Header settings button: ensure it opens the shared settings panel lazily
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    if (window.ui && typeof window.ui.openSettingsPanel === 'function') {
      window.ui.openSettingsPanel();
    } else {
      let panel = document.getElementById('settings-panel') || createSettingsPanel();
      if (panel && !document.body.contains(panel)) document.body.appendChild(panel);
      panel.classList.remove('hidden');
    }
  });

  // Provide helpers so toys can set their own About content without touching UI logic
  window.ui = window.ui || {};
  window.ui.getInfoModal = () => document.getElementById('info-modal');
  window.ui.setInfo = (html, title) => {
    let modal = document.getElementById('info-modal');
    if (!modal) modal = createInfoModal(html || undefined, title || undefined);
    else {
      const box = modal.querySelector('.modal-box');
      if (!box) return;
      if (typeof title === 'string') box.querySelector('h3').textContent = title;
      const content = box.querySelector('.info-content');
      if (content) content.innerHTML = html;
    }
  };
  window.ui.showInfo = () => {
    const modal = document.getElementById('info-modal');
    if (modal) modal.showModal();
  };

  // Home navigation
  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.addEventListener('click', () => {
    window.location.href = '../index.html';
  });

  return header;
}

// ------------------------------------------------------------
// FPS overlay (shared utility): show/hide and measure via RAF
// - Uses a lightweight RAF counter so it's cheap and works across toys
// - Exposed via window.ui.setFpsEnabled(enabled)
// ------------------------------------------------------------
(function setupFpsOverlay() {
  let fpsEl = null;
  let rafId = null;
  let last = performance.now();
  let frames = 0;
  let lastFpsUpdate = performance.now();
  let firstUpdate = false;

  function ensureEl() {
    if (fpsEl) return fpsEl;
    fpsEl = document.createElement('div');
    fpsEl.id = 'fps-overlay';
    fpsEl.className = 'bg-base-200 px-3 py-1 rounded shadow text-sm fixed z-[60]';
    fpsEl.style.left = '0.5rem';
    // Default top; we compute exact on enable
    fpsEl.style.top = '3.25rem';
    fpsEl.style.pointerEvents = 'none';
    fpsEl.textContent = 'FPS: –';
    document.body.appendChild(fpsEl);
    return fpsEl;
  }

  function positionOverlay() {
    const hdr = document.querySelector('div.fixed.top-0');
    if (!hdr) return;
    const rect = hdr.getBoundingClientRect();
    const top = rect.bottom + 6;
    ensureEl().style.top = top + 'px';
  }

  let tickFrames = 0; // render-completion ticks from toys

  function rafLoop(now) {
    frames++;
    const delta = now - last;
    last = now;

    // Update display immediately on first enable, then every 500ms
    if (firstUpdate || now - lastFpsUpdate > 500) {
      firstUpdate = false;
      const elapsedRaw = (now - lastFpsUpdate) / 1000; // seconds
      // Protect against tiny elapsed windows (which make FPS appear huge). Use
      // a small minimum window so the immediate display after enabling doesn't
      // show an inflated spike (but still updates quickly).
      const elapsed = Math.max(elapsedRaw, 0.25);

      // Prefer tick-based FPS if render completions were reported; else use RAF frames
      let fps = 0;
      if (tickFrames > 0) {
        fps = Math.round(tickFrames / elapsed);
      } else {
        fps = Math.round(frames / elapsed);
      }

      const el = ensureEl();
      el.textContent = `FPS: ${isFinite(fps) ? fps : '–'}`;

      // reset counters
      frames = 0;
      tickFrames = 0;
      lastFpsUpdate = now;
    }

    rafId = requestAnimationFrame(rafLoop);
  }

  // Exposed helper for toys to report a completed render/frame
  function tickFrame() {
    tickFrames++;
  }

  function setFpsEnabled(enabled) {
    if (enabled) {
      ensureEl();
      positionOverlay();
      // Start RAF loop if not already running
      if (!rafId) {
        firstUpdate = true; // Ensure immediate update on enable
        last = performance.now();
        lastFpsUpdate = last;
        frames = 0;
        rafId = requestAnimationFrame(rafLoop);
      }
      // Reposition on window resize (header may change)
      window.addEventListener('resize', positionOverlay);
    } else {
      // Stop
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (fpsEl) fpsEl.remove();
      fpsEl = null;
      window.removeEventListener('resize', positionOverlay);
    }

    // Ensure toggles in-page reflect the current state immediately
    document.querySelectorAll('#settings-show-fps, #global-show-fps').forEach(el => el.checked = !!enabled);
  }

  // Expose on ui
  window.ui = window.ui || {};
  window.ui.setFpsEnabled = setFpsEnabled;
  window.ui.isFpsEnabled = () => utils.isShowFps();
  window.ui.tickFrame = tickFrame; // toys call this to signal a completed render

  // Initialize based on persisted setting
  if (utils.isShowFps()) setFpsEnabled(true);
})();

// ------------------------------------------------------------
// Zoom Footer (Opt-in)
// ------------------------------------------------------------
function createZoomFooter({ onZoomIn, onZoomOut }) {
  // Idempotent: single zoom footer per document
  let existing = document.getElementById('zoom-footer');
  if (existing) return existing;
  const footer = document.createElement('div');
  footer.id = 'zoom-footer';
  footer.className =
    'fixed bottom-0 left-0 right-0 z-20 bg-base-200 border-t border-base-300';
  // Use CSS custom properties to expose footer height for toys if needed
  // We'll set --footer-height on body when footer is attached so toys can use CSS if they prefer.

  footer.innerHTML = `
    <!-- Row 1: zoom controls -->
    <div>
      <button class="btn" data-steps="-50">−50</button>
      <button class="btn" data-steps="-25">−25</button>
      <button class="btn" data-steps="-10">−10</button>
      <button class="btn" data-steps="-5">−5</button>
      <button class="btn" data-steps="-1">−1</button>

      <span class="mx-2 text-xs opacity-70">ZOOM</span>

      <button class="btn" data-steps="1">+1</button>
      <button class="btn" data-steps="5">+5</button>
      <button class="btn" data-steps="10">+10</button>
      <button class="btn" data-steps="25">+25</button>
      <button class="btn" data-steps="50">+50</button>
    </div>

    <!-- Row 2: zoom readout -->
    <div>
      <span id="zoom-readout" class="text-sm opacity-80">Zoom: 1.00×</span>
    </div>
  `;

  footer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const steps = parseInt(btn.dataset.steps, 10);
      if (steps > 0) onZoomIn(steps);
      else onZoomOut(Math.abs(steps));
    });
  });

  ensureFooterRowsStandard(footer);

  document.body.appendChild(footer);

  // Expose footer height as a CSS var so toys can compute layout by CSS if preferred
  function updateFooterHeightCSS() {
    const rect = footer.getBoundingClientRect();
    document.body.style.setProperty('--footer-height', Math.round(rect.height) + 'px');
  }
  updateFooterHeightCSS();
  window.addEventListener('resize', updateFooterHeightCSS);

  return footer;
}

// ------------------------------------------------------------
// Control Panel (Opt-in helper)
// ------------------------------------------------------------
// Simple, generic control panel for toys that need a footer area with
// arbitrary controls. Toys call `ui.createControlPanel(html)` and the UI
// layer handles rendering and updates.
function ensureFooterRowsStandard(container) {
  const content = container.querySelector('.control-content') || container;
  if (!content) return;
  const rows = Array.from(content.children);
  rows.forEach((row, index) => {
    // Remove any row-level padding/border/gap to enforce a consistent standard
    Array.from(row.classList).forEach(cls => {
      if (/^p[trblxy]?-[0-9]+$/.test(cls)) row.classList.remove(cls);
      if (/^gap-[0-9]+$/.test(cls)) row.classList.remove(cls);
      if (cls === 'border' || cls.startsWith('border-')) row.classList.remove(cls);
      if (cls === 'flex-nowrap') row.classList.remove(cls);
    });

    row.classList.add('flex', 'justify-center', 'items-center', 'w-full', 'gap-2', 'flex-wrap');
    row.classList.add(index === 0 ? 'py-2' : 'py-1');

    // Standardize touch targets and button sizing
    row.querySelectorAll('button, .btn, [role="button"]').forEach(btn => {
      btn.classList.add('touch-target');
      if (btn.classList.contains('btn')) {
        ['btn-xs', 'btn-sm', 'btn-md', 'btn-lg'].forEach(size => btn.classList.remove(size));
        btn.classList.add('btn-xs');
      }
    });
  });
}

function createControlPanel(html) {
  let panel = document.getElementById('control-panel');
  if (panel) {
    const content = panel.querySelector('.control-content');
    if (content) content.innerHTML = html;
    // Ensure rows are standardized whenever content updates
    ensureFooterRowsStandard(panel);
    return panel;
  }

  panel = document.createElement('div');
  panel.id = 'control-panel';
  panel.className = 'fixed bottom-0 left-0 right-0 z-20 bg-base-200 border-t border-base-300';
  panel.innerHTML = `
    <div class="max-w-4xl mx-auto control-content">${html}</div>
  `;

  document.body.appendChild(panel);
  // Ensure rows are center-aligned on initial creation
  ensureFooterRowsStandard(panel);
  return panel;
}

// ------------------------------------------------------------
// Playback / Time Controls (shared)
// ------------------------------------------------------------
// Returns an HTML snippet for playback controls (Pause + Speed slider)
// Toys call `ui.createPlaybackControls({ paused, speed })` to embed standard controls.
function createPlaybackControls({ paused = false, speed = 1, mode = 'slider' } = {}) {
  // mode: 'slider' (default) or 'buttons' for discrete slowdown buttons
  if (mode === 'buttons') {
    return `
      <div class="flex items-center gap-4 playback-controls">
        <button id="playback-playpause-btn" class="btn btn-sm" aria-pressed="${paused ? 'true' : 'false'}">${paused ? 'Play' : 'Pause'}</button>

        <div id="playback-speed-buttons" class="btn-group" role="tablist" aria-label="Playback speeds">
          <button class="btn btn-xs playback-speed-btn" data-speed="0.5">1/2</button>
          <button class="btn btn-xs playback-speed-btn" data-speed="0.25">1/4</button>
          <button class="btn btn-xs playback-speed-btn" data-speed="0.125">1/8</button>
          <button class="btn btn-xs playback-speed-btn" data-speed="0.0625">1/16</button>
          <button class="btn btn-xs playback-speed-btn" data-speed="0.03125">1/32</button>
        </div>
      </div>
    `;
  }

  // default: slider controls
  return `
    <div class="grid grid-cols-2 gap-4 playback-controls">
      <label class="label cursor-pointer">
        <span class="label-text">Pause</span>
        <input type="checkbox" class="toggle" id="playback-pause-toggle" ${paused ? 'checked' : ''} />
      </label>
      <label class="label">
        <span class="label-text">Speed</span>
        <input type="range" min="0.25" max="4" step="0.25" value="${speed}" class="range" id="playback-speed-slider" />
      </label>
    </div>
  `;
}

// Bind handlers to the shared playback controls. Returns an unsubscribe function.
function bindPlaybackControls({ onPauseChange, onSpeedChange } = {}) {
  const pauseToggle = document.getElementById('playback-pause-toggle');
  const speedSlider = document.getElementById('playback-speed-slider');

  const playPauseBtn = document.getElementById('playback-playpause-btn');
  const speedBtnsContainer = document.getElementById('playback-speed-buttons');

  function handleToggle(e) { if (typeof onPauseChange === 'function') onPauseChange(e.target.checked); }
  function handleSlider(e) { if (typeof onSpeedChange === 'function') onSpeedChange(parseFloat(e.target.value)); }
  function handlePlayPauseClick() {
    const pressed = playPauseBtn.getAttribute('aria-pressed') === 'true';
    const next = !pressed;
    playPauseBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    playPauseBtn.textContent = next ? 'Play' : 'Pause';
    if (typeof onPauseChange === 'function') onPauseChange(next);
  }
  function handleSpeedBtnClick(e) {
    const b = e.target.closest('.playback-speed-btn');
    if (!b) return;
    const sClicked = parseFloat(b.dataset.speed);

    // If clicked button is already active, treat as toggle->normal (1x)
    const wasActive = b.classList.contains('btn-active');
    // Clear active state for all speed buttons
    speedBtnsContainer.querySelectorAll('.playback-speed-btn').forEach(el => el.classList.remove('btn-active'));

    const newSpeed = wasActive ? 1 : sClicked;
    if (!wasActive) b.classList.add('btn-active');

    if (typeof onSpeedChange === 'function') onSpeedChange(newSpeed);
  }

  if (pauseToggle) pauseToggle.addEventListener('change', handleToggle);
  if (speedSlider) speedSlider.addEventListener('input', handleSlider);
  if (playPauseBtn) playPauseBtn.addEventListener('click', handlePlayPauseClick);
  if (speedBtnsContainer) speedBtnsContainer.addEventListener('click', handleSpeedBtnClick);

  return () => {
    if (pauseToggle) pauseToggle.removeEventListener('change', handleToggle);
    if (speedSlider) speedSlider.removeEventListener('input', handleSlider);
    if (playPauseBtn) playPauseBtn.removeEventListener('click', handlePlayPauseClick);
    if (speedBtnsContainer) speedBtnsContainer.removeEventListener('click', handleSpeedBtnClick);
  };
}

// ------------------------------------------------------------
// Settings Panel (Opt-in)
// ------------------------------------------------------------
function createSettingsPanel({ fractals = [], currentFractal, onFractalChange, extraTopHtml = '', extraHtml = '', showFractalSelection = false } = {}) {
  // If a panel already exists, we update its content and re-bind controls
  let panel = document.getElementById('settings-panel');

  // Build the inner HTML based on the incoming options
  const inner = `
    <div class="absolute inset-0 bg-black/40"></div>

    <div class="absolute right-0 top-0 h-full w-80 bg-base-200 p-0 shadow-lg flex flex-col">
      <div class="sticky top-0 bg-base-200 z-10 flex items-center justify-between gap-2 p-4 border-b border-base-300">
        <h2 class="text-lg font-bold m-0">Settings</h2>
        <button id="close-settings" class="btn btn-sm btn-ghost" aria-label="Close settings">✕</button>
      </div>

      <div class="overflow-y-auto p-4" style="height: calc(100% - 3.5rem);">
        ${extraTopHtml}

        ${showFractalSelection ? `<!-- Fractal Selection -->
        <div class="mb-4">
          <label class="label font-semibold">Fractal Type</label>
          <select id="fractal-select" class="select select-bordered w-full">
            ${fractals.map(f =>
              `<option value="${f.id}" ${f.id === currentFractal ? 'selected' : ''}>${f.label}</option>`
            ).join('')}
          </select>
          <p class="text-xs opacity-70 mt-1">
            Changing the fractal resets the view.
          </p>
        </div>` : ''}

        <!-- Mandelbrot Parameters -->
        <div id="mandelbrot-settings" class="mb-4 hidden">
          <label class="label font-semibold">Mandelbrot Settings</label>

          <label class="label text-sm">Max Iterations: <span id="mandelbrot-maxiter-readout">100</span></label>
          <input id="mandelbrot-maxiter" type="range" min="50" max="2000" step="10" class="range" value="100" />

          <label class="label text-sm mt-2">Color Offset: <span id="mandelbrot-color-readout" class="opacity-80">0.00</span></label>
          <input id="mandelbrot-color" type="range" min="0" max="1" step="0.01" class="range" value="0" />

          <button id="mandelbrot-reset" class="btn btn-sm mt-2">Reset fractal</button>
        </div>

        <!-- Julia Parameters -->
        <div id="julia-settings" class="mb-4 hidden">
          <label class="label font-semibold">Julia Parameters</label>

          <label class="label text-sm">Real (Cr): <span id="julia-cr-readout" class="opacity-80">-0.800</span></label>
          <input id="julia-cr" type="range" min="-1" max="1" step="0.001" class="range" />

          <label class="label text-sm mt-2">Imaginary (Ci): <span id="julia-ci-readout" class="opacity-80">0.156</span></label>
          <input id="julia-ci" type="range" min="-1" max="1" step="0.001" class="range" />

          <button id="julia-reset" class="btn btn-sm mt-2">Reset fractal</button>
        </div>

        <!-- Burning Ship Parameters -->
        <div id="burning-settings" class="mb-4 hidden">
          <label class="label font-semibold">Burning Ship Settings</label>

          <label class="label text-sm">Max Iterations: <span id="burning-maxiter-readout">100</span></label>
          <input id="burning-maxiter" type="range" min="50" max="2000" step="10" class="range" value="100" />

          <label class="label text-sm mt-2">Color Offset: <span id="burning-color-readout" class="opacity-80">0.00</span></label>
          <input id="burning-color" type="range" min="0" max="1" step="0.01" class="range" value="0" />

          <button id="burning-reset" class="btn btn-sm mt-2">Reset fractal</button>
        </div>

        <!-- Feedback -->
        <div class="mb-3">
          <label class="label cursor-pointer flex justify-between">
            <span>Sound</span>
            <input type="checkbox" id="settings-sound" class="toggle"
              ${utils.isSoundEnabled() ? 'checked' : ''} />
          </label>
        </div>

        <div class="mb-3">
          <label class="label cursor-pointer flex justify-between">
            <span>Show FPS</span>
            <input type="checkbox" id="settings-show-fps" class="toggle" ${utils.isShowFps() ? 'checked' : ''} />
          </label>
        </div>

        <div class="mb-3">
          <label class="label cursor-pointer flex justify-between">
            <span>Export Quality</span>
            <select id="settings-export-quality" class="select select-bordered w-40">
              <option value="hd" ${utils.getExportQuality() !== 'ultra' && utils.getExportQuality() !== 'ultra4' ? 'selected' : ''}>HD (DPR)</option>
              <option value="ultra" ${utils.getExportQuality() === 'ultra' ? 'selected' : ''}>Ultra (2× DPR)</option>
              <option value="ultra4" ${utils.getExportQuality() === 'ultra4' ? 'selected' : ''}>Ultra 4× (4×)</option>
            </select>
          </label>
          <p class="text-xs opacity-70 mt-1">Choose export quality for PNG downloads.</p>
        </div>

        <div class="mb-3">
          <label class="label cursor-pointer flex justify-between">
            <span>Vibration</span>
            <input type="checkbox" id="settings-vibration" class="toggle"
              ${utils.isVibrationEnabled() ? 'checked' : ''} />
          </label>
        </div>

        ${extraHtml}
      </div>
    </div>
  `;

  // If the panel existed previously, replace its content and rebind
  if (panel) {
    panel.className = 'fixed inset-0 z-30 hidden';
    panel.innerHTML = inner;
  } else {
    panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'fixed inset-0 z-30 hidden';
    panel.innerHTML = inner;
    document.body.appendChild(panel);
  }

  // Convenience selectors
  const fractalSelect = panel.querySelector('#fractal-select');
  const mandelbrotSection = panel.querySelector('#mandelbrot-settings');
  const juliaSection = panel.querySelector('#julia-settings');
  const burningSection = panel.querySelector('#burning-settings');

  function updateSettingsVisibility(type) {
    mandelbrotSection && mandelbrotSection.classList.toggle('hidden', type !== 'mandelbrot');
    juliaSection && juliaSection.classList.toggle('hidden', type !== 'julia');
    burningSection && burningSection.classList.toggle('hidden', type !== 'burningShip');
  }

  updateSettingsVisibility(currentFractal);

  // Bind controls (safe to call on re-create since innerHTML was reset)
  if (fractalSelect) {
    fractalSelect.addEventListener('change', e => {
      const type = e.target.value;
      updateSettingsVisibility(type);
      onFractalChange(type);
    });
  }

  const settingsSound = panel.querySelector('#settings-sound');
  if (settingsSound) settingsSound.addEventListener('change', e => {
    utils.toggleSound(e.target.checked);
    const headerSoundToggle = document.getElementById('sound-toggle');
    if (headerSoundToggle) headerSoundToggle.checked = e.target.checked;
  });

  const settingsVibration = panel.querySelector('#settings-vibration');
  if (settingsVibration) settingsVibration.addEventListener('change', e => {
    localStorage.setItem('vibrationEnabled', e.target.checked);
  });

  const settingsShowFps = panel.querySelector('#settings-show-fps');
  function handleShowFpsChange(checked) {
    localStorage.setItem('showFps', checked);
    // Try to set immediately; if ui.setFpsEnabled is not yet available, retry a few times
    let attempts = 0;
    function trySet() {
      if (window.ui && typeof window.ui.setFpsEnabled === 'function') {
        window.ui.setFpsEnabled(!!checked);
      } else if (attempts < 10) {
        attempts++;
        setTimeout(trySet, 100);
      }
    }
    trySet();
  }
  settingsShowFps && settingsShowFps.addEventListener('change', (e) => handleShowFpsChange(e.target.checked));

  const settingsExportQuality = panel.querySelector('#settings-export-quality');
  if (settingsExportQuality) {
    settingsExportQuality.addEventListener('change', (e) => {
      localStorage.setItem('exportQuality', e.target.value);
    });
    const stored = utils.getExportQuality() || 'hd';
    settingsExportQuality.value = stored;
  }

  // A single shared storage handler for the settings panel (added once)
  if (!window.__settingsPanelStorageHandlerAdded) {
    window.addEventListener('storage', (ev) => {
      const p = document.getElementById('settings-panel');
      if (!p) return;
      if (ev.key === 'showFps') {
        const val = ev.newValue === 'true';
        const s = p.querySelector('#settings-show-fps');
        if (s) s.checked = val;
        if (window.ui && typeof window.ui.setFpsEnabled === 'function') window.ui.setFpsEnabled(val);
      }
      if (ev.key === 'exportQuality') {
        const s = p.querySelector('#settings-export-quality');
        if (s) s.value = ev.newValue || 'hd';
      }
    });
    window.__settingsPanelStorageHandlerAdded = true;
  }

  function closePanel() {
    panel.classList.add('hidden');
  }

  const closeSettingsBtn = panel.querySelector('#close-settings');
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closePanel);

  panel.querySelector(':scope > div.absolute.inset-0')
    ?.addEventListener('click', closePanel);

  // Escape behavior - single handler added once
  if (!window.__settingsPanelKeyHandlerAdded) {
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const p = document.getElementById('settings-panel');
        if (p && !p.classList.contains('hidden')) p.classList.add('hidden');
      }
    });
    window.__settingsPanelKeyHandlerAdded = true;
  }

  // Ensure controls reflect current state
  const headerSoundToggle = document.getElementById('sound-toggle');
  const settingsSoundToggle = panel.querySelector('#settings-sound');
  if (headerSoundToggle && settingsSoundToggle) settingsSoundToggle.checked = headerSoundToggle.checked;
  const sv = panel.querySelector('#settings-vibration'); if (sv) sv.checked = utils.isVibrationEnabled();

  return panel;
}

// Expose helpers
window.ui = window.ui || {};
window.ui.createSettingsPanel = createSettingsPanel;
window.ui.openSettingsPanel = function(opts = {}) {
  const p = createSettingsPanel(opts);
  if (p && !document.body.contains(p)) document.body.appendChild(p);

  // Sync a few header-driven controls if present
  const headerSoundToggle = document.getElementById('sound-toggle');
  const settingsSoundToggle = p.querySelector('#settings-sound');
  if (headerSoundToggle && settingsSoundToggle) settingsSoundToggle.checked = headerSoundToggle.checked;

  const sv = p.querySelector('#settings-vibration'); if (sv) sv.checked = utils.isVibrationEnabled();

  p.classList.remove('hidden');
  return p;
};

// ------------------------------------------------------------
// Info Modal
// ------------------------------------------------------------
// Create a reusable About modal. Toys should call this with their own HTML
// content (string containing markup) so the UI layer doesn't have toy-specific
// text. We use DaisyUI classes for consistent spacing/typography and provide a
// sensible default message when none is supplied.
function createInfoModal(aboutContent, title = 'About This Toy') {
  const modal = document.createElement('dialog');
  modal.id = 'info-modal';
  modal.className = 'modal';

  const defaultContent = `
    <p class="text-base">This is an interactive software toy. Use the
    <strong>Settings</strong> panel to explore controls, and the <strong>Info</strong>
    modal for details. Learn more on the project
    <a href="https://github.com/J-Tynan/Software-Toys-PWA" class="link link-primary" target="_blank" rel="noopener">GitHub</a>.</p>
  `;

  const contentHtml = aboutContent || defaultContent;

  // If a modal already exists, update its content and return it so toys can
  // call this multiple times during initialization without creating duplicates.
  const existing = document.getElementById('info-modal');
  if (existing) {
    const box = existing.querySelector('.modal-box');
    if (box) {
      box.querySelector('h3').textContent = title;
      const contentEl = box.querySelector('.info-content');
      if (contentEl) contentEl.innerHTML = contentHtml;
    }
    return existing;
  }

  modal.innerHTML = `
    <div class="modal-box">
      <h3 class="font-bold text-lg">${title}</h3>
      <div class="py-2 space-y-2 info-content">${contentHtml}</div>
      <div class="modal-action">
        <form method="dialog">
          <button class="btn">Close</button>
        </form>
      </div>
    </div>
  `;

  // Append to document so it's available immediately
  document.body.appendChild(modal);
  return modal;
}

// ------------------------------------------------------------
// Toast Notifications
// ------------------------------------------------------------
function showToast(message, type = 'info', opts = {}) {
  const toast = document.createElement('div');
  // Keep visual alert classes but force reliable full-width and centered text
  toast.className = `alert alert-${type} fixed rounded-none px-4 py-3 shadow-lg transition-opacity duration-300 opacity-0`;
  toast.style.zIndex = '60';

  // Force full-width and use internal padding (left/right 12px) so toast truly spans viewport
  toast.style.left = '0';
  toast.style.right = '0';
  toast.style.paddingLeft = '12px';
  toast.style.paddingRight = '12px';
  toast.style.boxSizing = 'border-box';
  toast.style.display = 'flex';
  toast.style.justifyContent = 'center';
  toast.style.alignItems = 'center';
  // Ensure no stray margins cause horizontal offset
  toast.style.margin = '0';

  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<div style="width:100%; text-align:center;">${message}</div>`;

  // Compute bottom offset based on footer height if present
  const footerEl = document.querySelector('.fixed.bottom-0');
  const footerHeight = footerEl ? Math.ceil(footerEl.getBoundingClientRect().height) : 0;
  const bottomOffset = (opts.bottomOffset || 12) + footerHeight; // px
  toast.style.bottom = bottomOffset + 'px';

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  // Auto-dismiss after a short delay
  const visibleMs = opts.duration || 3000;
  const t = setTimeout(() => {
    toast.style.opacity = '0';
    // Remove after fade-out transition
    setTimeout(() => toast.remove(), 300);
  }, visibleMs);

  // Allow optional programmatic removal
  return {
    remove: () => { clearTimeout(t); toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }
  };
}

// ------------------------------------------------------------
// Export API
// ------------------------------------------------------------
window.ui = window.ui || {};
// Shared API version for basic compatibility checks
// BUMP to 2.0 — breaking change: header sound toggle removed; Settings panel contract updated
window.ui.SHARED_API_VERSION = '2.0';
Object.assign(window.ui, {
  createHeader,
  createZoomFooter,
  createSettingsPanel,
  createInfoModal,

  // Convenience helpers for toys and other code to update / show the About modal
  setInfo: (html, title) => createInfoModal(html, title),
  getInfoModal: () => document.getElementById('info-modal'),
  showInfo: () => { const m = document.getElementById('info-modal'); if (m) m.showModal(); },

  createControlPanel,
  createPlaybackControls,
  bindPlaybackControls,

  showToast
});

// Development-only testing hooks (exposed under window.__TEST__)
// These hooks should be disabled or no-ops in production builds. Build systems
// can replace process.env.NODE_ENV to 'production' to enforce this.
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') {
  window.__TEST__ = window.__TEST__ || {};
  window.__TEST__.getHeaderCount = () => document.querySelectorAll('.fixed.top-0').length;
  window.__TEST__.getFooterCount = () => document.querySelectorAll('.fixed.bottom-0').length;
  window.__TEST__.getCanvasComputedStyle = () => {
    const c = document.getElementById('canvas');
    if (!c) return null;
    const cs = getComputedStyle(c);
    return {
      position: cs.position,
      width: cs.width,
      height: cs.height
    };
  };
} else {
  // Production no-op hooks
  window.__TEST__ = window.__TEST__ || {};
  window.__TEST__.getHeaderCount = () => 0;
  window.__TEST__.getFooterCount = () => 0;
  window.__TEST__.getCanvasComputedStyle = () => null;
}

// Create custom settings modal (for per-toy options)
function createSettingsModal(contentHtml) {
  const modal = document.createElement('dialog');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box">
      <h3 class="font-bold text-lg">Settings</h3>
      <div class="py-4">
        ${contentHtml}
      </div>
      <div class="modal-action">
        <button class="btn" onclick="this.closest('dialog').close()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

window.ui.createSettingsModal = createSettingsModal;