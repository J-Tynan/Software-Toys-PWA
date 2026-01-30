// Renderer public API (minimal placeholder) - communicates with worker.js
let _worker = null;
let _initialized = false;
let _onError = null;
let _pendingRequestId = 0;

export async function init({ ctx, uiTick = null, settleMs = 140 } = {}) {
  if (_initialized) return;
  _worker = new Worker(new URL('./worker.js', import.meta.url));

  _worker.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.type === 'progress') {
      // Optionally forward to UI
    } else if (m.type === 'result') {
      // Draw the full-banded buffer to the provided ctx
      const { width, height, buffer } = m.payload || {};
      if (width && height && buffer && ctx) {
        const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
        ctx.putImageData(imageData, 0, 0);
        if (uiTick) uiTick();
      }
    } else if (m.type === 'error') {
      if (_onError) _onError(m.payload);
    }
  };

  _initialized = true;
}

export function requestRender(renderDescriptor = {}) {
  if (!_worker) return;
  _pendingRequestId++;
  const msg = { type: 'render', payload: { id: _pendingRequestId, renderDescriptor } };
  _worker.postMessage(msg);
  // Return quickly for preview
}

export function setScale(s) {
  // Placeholder scale for preview vs full-size rendering
  // TODO: Use this in the renderer/worker
}

let _settleTimer = null;
export function scheduleFullResRender(callback = null, settleMs = 140) {
  clearTimeout(_settleTimer);
  _settleTimer = setTimeout(() => {
    requestRender({ preview: false });
    if (typeof callback === 'function') callback();
  }, settleMs);
}

export function terminate() {
  if (_worker) {
    try { _worker.postMessage({ type: 'terminate' }); } catch (e) { /* ignore */ }
    _worker.terminate();
    _worker = null;
  }
  _initialized = false;
}

export function onError(cb) { _onError = cb; }
export function isInitialized() { return _initialized; }
