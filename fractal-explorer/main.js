// Fractal Explorer
// ------------------------------------------------------------
// Coordinates UI, interaction, and rendering.
// Heavy computation happens in fractal-worker.js.
//
// Features:
// - Progressive scanline rendering (no flicker / no black bands)
// - Dynamic resolution scaling during interaction
// - Persistent zoom footer + zoom readout
// - Keyboard shortcuts
// - Settings panel with per-fractal controls
// - Unified pointer/touch handling with CSS preview transforms
//
// Performance upgrades in this version:
// - Render coalescing: multiple rapid changes collapse into one render request
// - Preview vs final renders: sliders & interactions render cheap previews, final render on release
// - Avoid scheduleFullResRender() spam from sliders (final render is explicit)
// - Worker can be told "preview" so it can skip expensive paths (e.g., smooth coloring)
//   (Requires worker to read `preview` flag; recommended)
import { initExporter, exportScreenshot } from './exporter.js';

// ------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadGlobalTheme();

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // Initial canvas sizing will be computed based on available space between header & footer
  let width = 0;
  let height = 0;

  function updateCanvasLayout() {
    // Robustly compute header/footer heights and size the canvas to fit between them
    const headerEl = document.querySelector('.fixed.top-0');
    const footerEl = document.querySelector('.fixed.bottom-0');
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
    const footerHeight = footerEl ? Math.round(footerEl.getBoundingClientRect().height) : 0;

    // Expose CSS vars for optional use
    document.body.style.setProperty('--header-height', headerHeight + 'px');
    document.body.style.setProperty('--footer-height', footerHeight + 'px');

    // Position canvas between header and footer using explicit height (avoids fractional overlap)
    const top = headerHeight;
    const visibleHeight = Math.max(1, window.innerHeight - headerHeight - footerHeight);

    canvas.style.top = top + 'px';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = visibleHeight + 'px';
    // Clear bottom to avoid conflicts with top/height approach
    canvas.style.bottom = '';

    // Size in device pixels to match CSS pixels
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    canvas.width = width;
    canvas.height = height;

    // Recompute complex plane aspect
    maxIm = minIm + (maxRe - minRe) * height / width;
  }

  // Don't run layout until initial fractal state is defined below (avoids accessing minIm before it's set)

  const loadingOverlay = document.getElementById('loading-overlay');

  // ------------------------------------------------------------
  // Fractal view state
  // ------------------------------------------------------------
  let minRe = -2.5, maxRe = 1.0;
  let minIm = -1.2, maxIm = -1.2; // temp value, will be recalculated after layout

  // Now that view state exists, perform initial layout and compute correct maxIm
  updateCanvasLayout();

  // Helper: reset view to defaults and center vertically so the whole fractal is visible
  function resetViewToDefaults() {
    // Default horizontal range (classic Mandelbrot framing)
    minRe = -2.5;
    maxRe = 1.0;

    // Compute vertical range to keep the complex plane centered and fully visible
    const halfIm = (maxRe - minRe) * height / width / 2;
    minIm = -halfIm;
    maxIm = halfIm;
  }

  // Initialize to a centered Mandelbrot view so users 'wow' on first load
  resetViewToDefaults();

  let maxIter = 100;
  let baseMaxIter = maxIter; // desired "final" max iterations

  let currentFractalType = 'mandelbrot';
  let juliaCr = -0.8;
  let juliaCi = 0.156;

  // Palette / color offset (affects worker palette generation)
  let paletteOffset = 0;

  let demoIndex = 0;

  // Startup view storage per-fractal. We capture the initial visible
  // bounds on first load (after layout) and use it as the Reset target.
  const startupViews = {};

  // How much wider/taller to make the startup framing (1.33 ≈ 33% zoom out)
  const STARTUP_ZOOM_OUT = 1.33;

  function computeAdjustedView(minR, maxR, minI, maxI) {
    const centerRe = (minR + maxR) / 2;
    const centerIm = (minI + maxI) / 2;
    const widthRe = (maxR - minR) * STARTUP_ZOOM_OUT;
    const heightIm = (maxI - minI) * STARTUP_ZOOM_OUT;
    return {
      minRe: centerRe - widthRe / 2,
      maxRe: centerRe + widthRe / 2,
      minIm: centerIm - heightIm / 2,
      maxIm: centerIm + heightIm / 2
    };
  }

  function storeStartupView(fractal = currentFractalType) {
    startupViews[fractal] = { minRe, maxRe, minIm, maxIm };
  }

  function applyStartupZoomAndStore(fractal = currentFractalType) {
    const adj = computeAdjustedView(minRe, maxRe, minIm, maxIm);
    minRe = adj.minRe; maxRe = adj.maxRe; minIm = adj.minIm; maxIm = adj.maxIm;
    storeStartupView(fractal);
  }

  function restoreStartupView(fractal = currentFractalType) {
    const sv = startupViews[fractal];
    if (sv) {
      minRe = sv.minRe; maxRe = sv.maxRe; minIm = sv.minIm; maxIm = sv.maxIm;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------
  // Worker + render lifecycle
  // ------------------------------------------------------------
  let worker = null;
  let renderId = 0;

  // Render coalescing: store latest requested options; render once per frame.
  let renderQueued = false;
  let pendingRenderOpts = { preview: false };

  // ------------------------------------------------------------
  // Dynamic resolution scaling
  // ------------------------------------------------------------
  let renderScale = 1.0;
  const interactionScale = 0.5;
  const SETTLE_MS = 140;
  let settleTimer = null;

  function setScale(scale) {
    renderScale = scale;
  }

  function scheduleFullResRender() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      setScale(1.0);
      maxIter = baseMaxIter;
      requestRender({ preview: false });
    }, SETTLE_MS);
  }

  // ------------------------------------------------------------
  // Offscreen accumulation canvas
  // ------------------------------------------------------------
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d', { alpha: false });
  let needsRedraw = false;

  function initWorker() {
    if (worker) return;

    worker = new Worker('./fractal-worker.js');

    worker.onmessage = (e) => {
      const { id, width: w, height: h, yStart, bandHeight, buffer } = e.data || {};
      if (id !== renderId) return;

      if (tmpCanvas.width !== w || tmpCanvas.height !== h) {
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        tmpCtx.clearRect(0, 0, w, h);
      }

      const pixels = new Uint8ClampedArray(buffer);
      const img = new ImageData(pixels, w, bandHeight);
      tmpCtx.putImageData(img, 0, yStart);

      if (!needsRedraw) {
        needsRedraw = true;
        requestAnimationFrame(() => {
          needsRedraw = false;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(tmpCanvas, 0, 0, width, height);
          // Notify shared FPS overlay that a render completed (if available)
          if (window.ui && typeof window.ui.tickFrame === 'function') window.ui.tickFrame();
        });
      }
    };
  }

  function postRenderToWorker(opts = {}) {
    initWorker();
    renderId++;

    const w = Math.max(1, Math.floor(width * renderScale));
    const h = Math.max(1, Math.floor(height * renderScale));

    worker.postMessage({
      id: renderId,
      width: w,
      height: h,
      minRe,
      maxRe,
      minIm,
      maxIm,
      maxIter,
      fractalType: currentFractalType,
      juliaCr,
      juliaCi,
      paletteOffset,
      preview: opts.preview === true
    });
  }

  function requestRender(opts = {}) {
    // Coalesce multiple calls; latest options win.
    pendingRenderOpts = Object.assign(pendingRenderOpts, opts);

    if (renderQueued) return;
    renderQueued = true;

    requestAnimationFrame(() => {
      const optsToSend = pendingRenderOpts;
      pendingRenderOpts = { preview: false };
      renderQueued = false;
      postRenderToWorker(optsToSend);
    });
  }

  // ------------------------------------------------------------
  // Zoom engine
  // ------------------------------------------------------------
  function zoomSteps(stepCount, direction, cx = width / 2, cy = height / 2) {
    const base = 0.9;
    const factor = direction === 'in'
      ? Math.pow(base, stepCount)
      : Math.pow(1 / base, stepCount);

    const centerRe = minRe + cx * (maxRe - minRe) / width;
    const centerIm = minIm + cy * (maxIm - minIm) / height;

    minRe = centerRe + (minRe - centerRe) * factor;
    maxRe = centerRe + (maxRe - centerRe) * factor;
    minIm = centerIm + (minIm - centerIm) * factor;
    maxIm = centerIm + (maxIm - centerIm) * factor;

    setScale(interactionScale);
    maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
    requestRender({ preview: true });
    scheduleFullResRender();
    updateZoomReadout();
  }

  // ------------------------------------------------------------
  // Initial UI state
  // ------------------------------------------------------------
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  canvas.classList.remove('opacity-0');

  // Save initial viewport width (complex plane) for zoom readout
  const initialReWidth = maxRe - minRe;

  // Capture and apply a slightly zoomed-out startup framing so the whole
  // fractal is visible on first load, then store it as the Reset target.
  applyStartupZoomAndStore();

  function updateZoomReadout() {
    const zoomReadoutEl = document.getElementById('zoom-readout');
    if (!zoomReadoutEl) return;
    const curWidth = maxRe - minRe;
    const zoom = (initialReWidth / curWidth) || 1;
    zoomReadoutEl.textContent = `Zoom: ${zoom.toFixed(2)}×`;
  }

  // ------------------------------------------------------------
  // Demo locations (curated, safe zoom levels)
  // ------------------------------------------------------------
  const DEMO_LOCATIONS = {
    mandelbrot: [
      {
        label: 'Seahorse Valley',
        minRe: -0.7485, maxRe: -0.7475,
        minIm: 0.0995, maxIm: 0.1005
      },
      {
        label: 'Elephant Trunk',
        minRe: 0.25, maxRe: 0.26,
        minIm: -0.01, maxIm: 0.01
      },
      {
        label: 'Spiral Arms',
        minRe: -0.75, maxRe: -0.74,
        minIm: 0.11, maxIm: 0.12
      },
      {
        label: 'Mini Mandelbrot',
        minRe: -1.25, maxRe: -1.15,
        minIm: 0.2, maxIm: 0.3
      },
      {
        label: 'Valley of Ghosts',
        minRe: -0.745, maxRe: -0.744,
        minIm: 0.112, maxIm: 0.113
      }
    ],

    julia: [
      {
        label: 'Classic Julia',
        juliaCr: -0.8, juliaCi: 0.156,
        minRe: -1.5, maxRe: 1.5,
        minIm: -1.5, maxIm: 1.5
      },
      {
        label: 'Spider Web',
        juliaCr: -0.70176, juliaCi: -0.3842,
        minRe: -1.5, maxRe: 1.5,
        minIm: -1.5, maxIm: 1.5
      },
      {
        label: 'Dusty Julia',
        juliaCr: 0.285, juliaCi: 0.01,
        minRe: -1.5, maxRe: 1.5,
        minIm: -1.5, maxIm: 1.5
      },
      {
        label: 'Swirl Galaxy',
        juliaCr: -0.4, juliaCi: 0.6,
        minRe: -1.5, maxRe: 1.5,
        minIm: -1.5, maxIm: 1.5
      },
      {
        label: 'Double Spiral',
        juliaCr: -0.7269, juliaCi: 0.1889,
        minRe: -1.5, maxRe: 1.5,
        minIm: -1.5, maxIm: 1.5
      }
    ],

    burningShip: [
      {
        label: 'Ship Core',
        minRe: -1.8, maxRe: -1.7,
        minIm: -0.05, maxIm: 0.05
      },
      {
        label: 'Flame Crest',
        minRe: -1.75, maxRe: -1.74,
        minIm: -0.03, maxIm: 0.03
      },
      {
        label: 'Jagged Coast',
        minRe: -1.82, maxRe: -1.81,
        minIm: -0.06, maxIm: 0.06
      },
      {
        label: 'Mini Ship',
        minRe: -1.76, maxRe: -1.755,
        minIm: -0.02, maxIm: 0.02
      },
      {
        label: 'Turbulent Bay',
        minRe: -1.78, maxRe: -1.77,
        minIm: -0.04, maxIm: 0.04
      }
    ]
  };

  // ------------------------------------------------------------
  // Pointer / touch handling (unified)
  // ------------------------------------------------------------
  canvas.style.touchAction = 'none';

  const activePointers = new Map(); // pointerId -> {x,y}
  let gesture = null; // { type: 'pan'|'pinch', ... }

  // Lightweight transform state (pixels & scale)
  let previewTx = 0, previewTy = 0, previewScale = 1;
  let rafPending = false;

  function applyPreviewTransform() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      canvas.style.transform = `translate(${previewTx}px, ${previewTy}px) scale(${previewScale})`;
      rafPending = false;
    });
  }

  function pixelsToComplexDelta(dx, dy, curMinRe = minRe, curMaxRe = maxRe, curMinIm = minIm, curMaxIm = maxIm) {
    const deltaRe = dx * (curMaxRe - curMinRe) / width;
    const deltaIm = dy * (curMaxIm - curMinIm) / height;
    return { deltaRe, deltaIm };
  }

  // Double-tap detection
  let lastTap = { time: 0, x: 0, y: 0 };
  const DOUBLE_TAP_MS = 300;
  const TAP_MOVE_TOLERANCE = 10; // px

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const now = Date.now();
    if (
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(lastTap.x - e.clientX, lastTap.y - e.clientY) < TAP_MOVE_TOLERANCE
    ) {
      zoomSteps(1, 'in', e.clientX, e.clientY);
      lastTap.time = 0;
      return;
    }
    lastTap = { time: now, x: e.clientX, y: e.clientY };

    if (activePointers.size === 1) {
      const p = activePointers.values().next().value;
      gesture = {
        type: 'pan',
        startX: p.x,
        startY: p.y,
        accTx: 0,
        accTy: 0,
        baseMinRe: minRe, baseMaxRe: maxRe, baseMinIm: minIm, baseMaxIm: maxIm
      };

      setScale(interactionScale);
      maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
    } else if (activePointers.size === 2) {
      const it = activePointers.values();
      const p1 = it.next().value;
      const p2 = it.next().value;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      gesture = {
        type: 'pinch',
        startDist: dist,
        startCx: cx, startCy: cy,
        baseMinRe: minRe, baseMaxRe: maxRe, baseMinIm: minIm, baseMaxIm: maxIm
      };

      setScale(interactionScale);
      maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;

    if (gesture.type === 'pan' && activePointers.size === 1) {
      const p = activePointers.values().next().value;
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;

      previewTx = gesture.accTx + dx;
      previewTy = gesture.accTy + dy;
      previewScale = 1;
      applyPreviewTransform();
    } else if (gesture.type === 'pinch' && activePointers.size === 2) {
      const it = activePointers.values();
      const p1 = it.next().value;
      const p2 = it.next().value;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      const s = dist / gesture.startDist;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      previewScale = s;
      previewTx = (cx - gesture.startCx) - (s - 1) * (gesture.startCx - width / 2);
      previewTy = (cy - gesture.startCy) - (s - 1) * (gesture.startCy - height / 2);

      applyPreviewTransform();
    }
  });

  function commitPanAndZoom() {
    if (!gesture) return;

    const baseMinRe = gesture.baseMinRe, baseMaxRe = gesture.baseMaxRe,
      baseMinIm = gesture.baseMinIm, baseMaxIm = gesture.baseMaxIm;

    if (gesture.type === 'pinch') {
      const s = previewScale || 1;

      const it = activePointers.values();
      let cx = gesture.startCx, cy = gesture.startCy;
      if (activePointers.size === 2) {
        const p1 = it.next().value;
        const p2 = it.next().value;
        cx = (p1.x + p2.x) / 2;
        cy = (p1.y + p2.y) / 2;
      }

      const centerRe = baseMinRe + cx * (baseMaxRe - baseMinRe) / width;
      const centerIm = baseMinIm + cy * (baseMaxIm - baseMinIm) / height;

      minRe = centerRe + (baseMinRe - centerRe) / s;
      maxRe = centerRe + (baseMaxRe - centerRe) / s;
      minIm = centerIm + (baseMinIm - centerIm) / s;
      maxIm = centerIm + (baseMaxIm - centerIm) / s;
    }

    const { deltaRe, deltaIm } = pixelsToComplexDelta(previewTx, previewTy, minRe, maxRe, minIm, maxIm);
    minRe -= deltaRe; maxRe -= deltaRe;
    minIm -= deltaIm; maxIm -= deltaIm;

    // Clear preview state and any lingering transforms immediately
    previewTx = 0; previewTy = 0; previewScale = 1;
    canvas.style.transform = '';

    // Make sure layout is correct (in case footer wrapped while interacting)
    updateCanvasLayout();
    maxIm = minIm + (maxRe - minRe) * height / width;

    setScale(interactionScale);
    maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
    requestRender({ preview: true });
    scheduleFullResRender();
    updateZoomReadout();
  }

  canvas.addEventListener('pointerup', (e) => {
    activePointers.delete(e.pointerId);
    canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);

    if (activePointers.size === 0 && gesture) {
      commitPanAndZoom();
      gesture = null;
    } else if (activePointers.size === 1 && gesture && gesture.type === 'pinch') {
      const remaining = activePointers.values().next().value;
      gesture = {
        type: 'pan',
        startX: remaining.x,
        startY: remaining.y,
        accTx: 0,
        accTy: 0,
        baseMinRe: minRe, baseMaxRe: maxRe, baseMinIm: minIm, baseMaxIm: maxIm
      };
    }
  });

  // Global safety: if user releases pointer outside canvas, ensure we commit
  // and clear any preview transforms so the canvas doesn't stay shifted.
  window.addEventListener('pointerup', (e) => {
    if (activePointers.size === 0 && gesture) {
      commitPanAndZoom();
      gesture = null;
    }
    // Clear any lingering visual transform regardless
    previewTx = 0; previewTy = 0; previewScale = 1;
    canvas.style.transform = '';
  });

  // Also guard against pointercancel at window level
  window.addEventListener('pointercancel', (e) => {
    activePointers.clear();
    previewTx = 0; previewTy = 0; previewScale = 1;
    canvas.style.transform = '';
    gesture = null;
  });

  canvas.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0 && gesture) {
      previewTx = 0; previewTy = 0; previewScale = 1;
      canvas.style.transform = '';
      gesture = null;

      setScale(1.0);
      maxIter = baseMaxIter;
      requestRender({ preview: false });
    }
  });

  canvas.addEventListener('dblclick', (e) => {
    zoomSteps(1, 'in', e.clientX, e.clientY);
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 200);
  });

  // ------------------------------------------------------------
  // Wheel zoom
  // ------------------------------------------------------------
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomSteps(1, e.deltaY < 0 ? 'in' : 'out', e.offsetX, e.offsetY);
  }, { passive: false });

  // ------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case '+':
      case '=': zoomSteps(1, 'in'); break;
      case '-': zoomSteps(1, 'out'); break;
      case ']': zoomSteps(5, 'in'); break;
      case '[': zoomSteps(5, 'out'); break;
      case '}': zoomSteps(10, 'in'); break;
      case '{': zoomSteps(10, 'out'); break;
    }
  });

  // ------------------------------------------------------------
  // Shared UI
  // ------------------------------------------------------------
  ui.createHeader('Fractal Explorer');

  // Initialize exporter with UI and state getter
  initExporter({
    ui,
    getState: () => ({ width, height, minRe, maxRe, minIm, maxIm, currentFractalType, maxIter, juliaCr, juliaCi, paletteOffset, initialReWidth }),
    workerPath: './fractal-worker.js',
    maxDim: 8000
  });

  // Load About content from `about-this-toy.md` in this folder (preferred).
  // If fetch fails (e.g., running from filesystem preview), fall back to a hard-coded
  // HTML snippet so the modal still works.
  const FALLBACK_ABOUT = `
    <div class="space-y-2">
      <p class="text-base">Explore the Mandelbrot and Julia fractals with live rendering, gestures, and per-fractal settings.</p>
      <p class="text-base">Controls: <strong>Drag</strong> to pan, <strong>Pinch</strong> to zoom, and use the <em>Settings</em> panel for iterations and colour.</p>
      <p class="text-base">Learn more: <a href="https://en.wikipedia.org/wiki/Mandelbrot_set" target="_blank" rel="noopener" class="link link-primary">Mandelbrot on Wikipedia</a></p>
    </div>
  `;

  // Small, dependency-free Markdown -> HTML converter. Supports headings (###),
  // simple lists, paragraphs and links. This keeps the project dependency free
  // while allowing rich authorable content in .md files.
  function markdownToHtml(md) {
    md = md.replace(/\r/g, '');

    // Convert links: [text](url)
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
      return `<a class="link link-primary" href="${url}" target="_blank" rel="noopener">${text}</a>`;
    });

    // Convert bold and italics
    md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Split into blocks separated by blank lines
    const blocks = md.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

    const out = blocks.map(block => {
      if (block.startsWith('### ')) {
        const text = block.replace(/^###\s+/, '').trim();
        return `<h3 class="font-bold text-base">${text}</h3>`;
      }

      // Simple unordered list support (lines starting with * or -)
      if (/^(?:\*|-)\s+/m.test(block)) {
        const items = block
          .split(/\n/)
          .map(line => line.replace(/^(?:\*|-)\s+/, '').trim())
          .filter(Boolean)
          .map(li => `<li class="text-base">${li}</li>`)
          .join('\n');
        return `<ul class="pl-5 list-disc space-y-1">${items}</ul>`;
      }

      // Default: paragraph
      return `<p class="text-base">${block}</p>`;
    }).join('\n');

    return `<div class="space-y-2">${out}</div>`;
  }

  async function registerAboutFromMd() {
    const mdPath = 'about-this-toy.md';
    try {
      const res = await fetch(mdPath, { cache: 'no-store' });
      if (res.ok) {
        const md = await res.text();
        const html = markdownToHtml(md);
        if (window.ui && typeof window.ui.createInfoModal === 'function') {
          window.ui.createInfoModal(html, 'Fractal Explorer');
          return;
        }
      }
    } catch (e) {
      // Ignore and fall back
    }

    // Fall back to built-in HTML if fetch fails
    if (window.ui && typeof window.ui.createInfoModal === 'function') {
      window.ui.createInfoModal(FALLBACK_ABOUT, 'Fractal Explorer');
    }
  }

  // Kick off registration (non-blocking)
  registerAboutFromMd();

  // Keep Home button visible so header buttons lay out correctly
  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.style.display = ''; // ensure it remains in flow

  // Add an Export button to the header (Fractal Explorer only) to export the current view as PNG
  (function addExportButton() {
    const resetBtn = document.getElementById('reset-btn');
    if (!resetBtn) return;

    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.className = 'btn btn-xs btn-primary tooltip';
    exportBtn.setAttribute('data-tip', 'Export PNG');
    exportBtn.textContent = 'Export';

    resetBtn.parentNode.insertBefore(exportBtn, resetBtn);

    exportBtn.addEventListener('click', async () => {
      try {
        await exportScreenshot();
      } catch (err) {
        console.error('Export failed', err);
        ui.showToast(err && err.message ? err.message : 'Export failed', 'error');
      }
    });
  })();

  ui.createZoomFooter({
    onZoomIn: steps => zoomSteps(steps, 'in'),
    onZoomOut: steps => zoomSteps(steps, 'out')
  });

  // Recompute layout now that header/footer are present so the canvas is
  // correctly sized and positioned between them (prevents rendering under UI)
  updateCanvasLayout();
  // Recompute complex-plane aspect based on new size
  maxIm = minIm + (maxRe - minRe) * height / width;

  // No hardcoded padding; layout computed from header/footer heights in updateCanvasLayout()
  updateZoomReadout();

  // Re-capture startup view now that header/footer layout is finalized and ensure it includes the zoom-out
  applyStartupZoomAndStore();

  // Observe header/footer size changes (e.g., responsive wrapping) and recompute layout
  (function observeHeaderFooter() {
    const hdr = document.querySelector('.fixed.top-0');
    const ftr = document.querySelector('.fixed.bottom-0');
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(() => {
      updateCanvasLayout();
      maxIm = minIm + (maxRe - minRe) * height / width;
      // Force a fresh render at current settings when layout changes
      setScale(1.0);
      requestRender({ preview: false });
      updateZoomReadout();
    });
    if (hdr) ro.observe(hdr);
    if (ftr) ro.observe(ftr);
  })();

  // Ensure a fresh render at the correct size
  setScale(1.0);
  maxIter = baseMaxIter;
  requestRender({ preview: false });

  // ------------------------------------------------------------
  // Settings Panel
  // ------------------------------------------------------------
  const FRACTALS = [
    { id: 'mandelbrot', label: 'Mandelbrot' },
    { id: 'julia', label: 'Julia' },
    { id: 'burningShip', label: 'Burning Ship' }
  ];

  ui.createSettingsPanel({
    fractals: FRACTALS,
    currentFractal: currentFractalType,
    onFractalChange: type => {
      currentFractalType = type;

      // Reset to the centered default view for a good initial "wow" effect
      resetViewToDefaults();

      setScale(1.0);
      maxIter = baseMaxIter;
      requestRender({ preview: false });
      updateZoomReadout();

      // Save this default as the startup view for the selected fractal, applying the startup zoom-out
      applyStartupZoomAndStore(type);

      ui.showToast(`Switched to ${type}`, 'info');
    }
  });

  // ------------------------------------------------------------
  // Slider helpers (preview vs final)
  // ------------------------------------------------------------
  function attachRangePreviewFinal(rangeEl, { onPreview, onFinal }) {
    if (!rangeEl) return;

    // Preview: frequent, cheap
    rangeEl.addEventListener('input', () => {
      onPreview && onPreview();
    });

    // Final: once on release
    rangeEl.addEventListener('change', () => {
      onFinal && onFinal();
    });

    // Mobile safety: if change is flaky, pointer release acts as final.
    rangeEl.addEventListener('pointerup', () => {
      onFinal && onFinal();
    });
    rangeEl.addEventListener('touchend', () => {
      onFinal && onFinal();
    }, { passive: true });
  }

  // ------------------------------------------------------------
  // Julia parameter wiring
  // ------------------------------------------------------------
  const juliaCrSlider = document.getElementById('julia-cr');
  const juliaCiSlider = document.getElementById('julia-ci');

  if (juliaCrSlider && juliaCiSlider) {
    juliaCrSlider.value = juliaCr;
    juliaCiSlider.value = juliaCi;

      // Initialize Julia readouts
    const juliaCrReadoutInit = document.getElementById('julia-cr-readout');
    const juliaCiReadoutInit = document.getElementById('julia-ci-readout');
    if (juliaCrReadoutInit) juliaCrReadoutInit.textContent = juliaCr.toFixed(3);
    if (juliaCiReadoutInit) juliaCiReadoutInit.textContent = juliaCi.toFixed(3);

    attachRangePreviewFinal(juliaCrSlider, {
      onPreview: () => {
        juliaCr = parseFloat(juliaCrSlider.value);
        const r = juliaCr.toFixed(3);
        const crReadout = document.getElementById('julia-cr-readout');
        if (crReadout) crReadout.textContent = r;
        setScale(interactionScale);
        maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
        requestRender({ preview: true });
      },
      onFinal: () => {
        juliaCr = parseFloat(juliaCrSlider.value);
        const r = juliaCr.toFixed(3);
        const crReadout = document.getElementById('julia-cr-readout');
        if (crReadout) crReadout.textContent = r;
        setScale(1.0);
        maxIter = baseMaxIter;
        requestRender({ preview: false });
      }
    });

    attachRangePreviewFinal(juliaCiSlider, {
      onPreview: () => {
        juliaCi = parseFloat(juliaCiSlider.value);
        const r = juliaCi.toFixed(3);
        const ciReadout = document.getElementById('julia-ci-readout');
        if (ciReadout) ciReadout.textContent = r;
        setScale(interactionScale);
        maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
        requestRender({ preview: true });
      },
      onFinal: () => {
        juliaCi = parseFloat(juliaCiSlider.value);
        const r = juliaCi.toFixed(3);
        const ciReadout = document.getElementById('julia-ci-readout');
        if (ciReadout) ciReadout.textContent = r;
        setScale(1.0);
        maxIter = baseMaxIter;
        requestRender({ preview: false });
      }
    });
  }

  // ------------------------------------------------------------
  // Settings panel: additional sliders and reset buttons for each fractal
  // ------------------------------------------------------------
  const mandelbrotMaxSlider = document.getElementById('mandelbrot-maxiter');
  const mandelbrotMaxReadout = document.getElementById('mandelbrot-maxiter-readout');
  const mandelbrotColor = document.getElementById('mandelbrot-color');
  const mandelbrotReset = document.getElementById('mandelbrot-reset');

  const burningMaxSlider = document.getElementById('burning-maxiter');
  const burningMaxReadout = document.getElementById('burning-maxiter-readout');
  const burningColor = document.getElementById('burning-color');
  const burningReset = document.getElementById('burning-reset');

  const juliaReset = document.getElementById('julia-reset');

  // Defaults
  const DEFAULT_MAX_ITER = baseMaxIter || 100;
  const DEFAULT_PALETTE_OFFSET = 0;
  const DEFAULT_JULIA_CR = -0.8;
  const DEFAULT_JULIA_CI = 0.156;

  if (mandelbrotMaxSlider && mandelbrotMaxReadout) {
    mandelbrotMaxSlider.value = baseMaxIter;
    mandelbrotMaxReadout.textContent = baseMaxIter;

    // Ensure color readout reflects current palette offset
    const mandelbrotColorReadout = document.getElementById('mandelbrot-color-readout');
    if (mandelbrotColorReadout) mandelbrotColorReadout.textContent = parseFloat(paletteOffset).toFixed(2);

    attachRangePreviewFinal(mandelbrotMaxSlider, {
      onPreview: () => {
        const v = parseInt(mandelbrotMaxSlider.value, 10);
        baseMaxIter = v;
        maxIter = Math.max(32, Math.floor(v * 0.6));
        mandelbrotMaxReadout.textContent = v;

        setScale(interactionScale);
        requestRender({ preview: true });
      },
      onFinal: () => {
        const v = parseInt(mandelbrotMaxSlider.value, 10);
        baseMaxIter = v;
        maxIter = baseMaxIter;

        setScale(1.0);
        requestRender({ preview: false });
      }
    });
  }

  if (burningMaxSlider && burningMaxReadout) {
    burningMaxSlider.value = baseMaxIter;
    burningMaxReadout.textContent = baseMaxIter;

    const burningColorReadout = document.getElementById('burning-color-readout');
    if (burningColorReadout) burningColorReadout.textContent = parseFloat(paletteOffset).toFixed(2);

    attachRangePreviewFinal(burningMaxSlider, {
      onPreview: () => {
        const v = parseInt(burningMaxSlider.value, 10);
        baseMaxIter = v;
        maxIter = Math.max(32, Math.floor(v * 0.6));
        burningMaxReadout.textContent = v;

        setScale(interactionScale);
        requestRender({ preview: true });
      },
      onFinal: () => {
        const v = parseInt(burningMaxSlider.value, 10);
        baseMaxIter = v;
        maxIter = baseMaxIter;

        setScale(1.0);
        requestRender({ preview: false });
      }
    });
  }

  const mandelbrotColorReadout = document.getElementById('mandelbrot-color-readout');
  const burningColorReadout = document.getElementById('burning-color-readout');

  if (mandelbrotColor) {
    mandelbrotColor.value = paletteOffset;
    if (mandelbrotColorReadout) mandelbrotColorReadout.textContent = parseFloat(mandelbrotColor.value).toFixed(2);

    attachRangePreviewFinal(mandelbrotColor, {
      onPreview: () => {
        paletteOffset = parseFloat(mandelbrotColor.value);
        if (mandelbrotColorReadout) mandelbrotColorReadout.textContent = paletteOffset.toFixed(2);
        setScale(interactionScale);
        maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
        requestRender({ preview: true });
      },
      onFinal: () => {
        paletteOffset = parseFloat(mandelbrotColor.value);
        if (mandelbrotColorReadout) mandelbrotColorReadout.textContent = paletteOffset.toFixed(2);
        setScale(1.0);
        maxIter = baseMaxIter;
        requestRender({ preview: false });
      }
    });
  }

  if (burningColor) {
    burningColor.value = paletteOffset;
    if (burningColorReadout) burningColorReadout.textContent = parseFloat(burningColor.value).toFixed(2);

    attachRangePreviewFinal(burningColor, {
      onPreview: () => {
        paletteOffset = parseFloat(burningColor.value);
        if (burningColorReadout) burningColorReadout.textContent = paletteOffset.toFixed(2);
        setScale(interactionScale);
        maxIter = Math.max(32, Math.floor(baseMaxIter * 0.6));
        requestRender({ preview: true });
      },
      onFinal: () => {
        paletteOffset = parseFloat(burningColor.value);
        if (burningColorReadout) burningColorReadout.textContent = paletteOffset.toFixed(2);
        setScale(1.0);
        maxIter = baseMaxIter;
        requestRender({ preview: false });
      }
    });
  }

  // Reset handlers
  if (mandelbrotReset) {
    mandelbrotReset.addEventListener('click', () => {
      if (mandelbrotMaxSlider) mandelbrotMaxSlider.value = DEFAULT_MAX_ITER;
      if (mandelbrotMaxReadout) mandelbrotMaxReadout.textContent = DEFAULT_MAX_ITER;
      baseMaxIter = maxIter = DEFAULT_MAX_ITER;

      if (mandelbrotColor) mandelbrotColor.value = DEFAULT_PALETTE_OFFSET;
      paletteOffset = DEFAULT_PALETTE_OFFSET;

      setScale(1.0);
      requestRender({ preview: false });
      updateZoomReadout();
    });
  }

  if (burningReset) {
    burningReset.addEventListener('click', () => {
      if (burningMaxSlider) burningMaxSlider.value = DEFAULT_MAX_ITER;
      if (burningMaxReadout) burningMaxReadout.textContent = DEFAULT_MAX_ITER;
      baseMaxIter = maxIter = DEFAULT_MAX_ITER;

      if (burningColor) burningColor.value = DEFAULT_PALETTE_OFFSET;
      paletteOffset = DEFAULT_PALETTE_OFFSET;

      setScale(1.0);
      requestRender({ preview: false });
      updateZoomReadout();
    });
  }

  if (juliaReset) {
    juliaReset.addEventListener('click', () => {
      juliaCr = DEFAULT_JULIA_CR;
      juliaCi = DEFAULT_JULIA_CI;

      const jc = document.getElementById('julia-cr');
      const ji = document.getElementById('julia-ci');
      if (jc) jc.value = juliaCr;
      if (ji) ji.value = juliaCi;

      setScale(1.0);
      maxIter = baseMaxIter;
      requestRender({ preview: false });
      updateZoomReadout();
    });
  }

  // ------------------------------------------------------------
  // Header buttons
  // ------------------------------------------------------------
  const demoBtn = document.querySelector('.fractal-explorer-demo-btn') || document.getElementById('demo-btn');
  if (demoBtn) demoBtn.addEventListener('click', () => {
    const demos = DEMO_LOCATIONS[currentFractalType];
    if (!demos || demos.length === 0) return;

    const demo = demos[demoIndex % demos.length];
    demoIndex++;

    // Apply viewport
    minRe = demo.minRe;
    maxRe = demo.maxRe;
    minIm = demo.minIm;
    maxIm = demo.maxIm;

    // Apply Julia parameters if needed
    if (currentFractalType === 'julia') {
      if (typeof demo.juliaCr === 'number') juliaCr = demo.juliaCr;
      if (typeof demo.juliaCi === 'number') juliaCi = demo.juliaCi;

      const jc = document.getElementById('julia-cr');
      const ji = document.getElementById('julia-ci');
      if (jc) jc.value = juliaCr;
      if (ji) ji.value = juliaCi;
    }

    // Render at full quality (demo should look good)
    setScale(1.0);
    maxIter = baseMaxIter;
    requestRender({ preview: false });
    updateZoomReadout();

    // Brief label for the user
    ui.showToast(`Demo: ${demo.label}`, 'info');
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    // Restore to the captured startup view if available, otherwise fall back to default
    const restored = restoreStartupView(currentFractalType);
    if (!restored) {
      resetViewToDefaults();
    }

    setScale(1.0);
    maxIter = baseMaxIter;
    requestRender({ preview: false });
    updateZoomReadout();
  });

  window.addEventListener('resize', () => {
    updateCanvasLayout();

    setScale(1.0);
    maxIter = baseMaxIter;
    requestRender({ preview: false });
    updateZoomReadout();
  });

  // Initial render
  requestRender({ preview: false });
});