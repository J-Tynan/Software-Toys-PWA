let worker = null;
let initialized = false;
let onErrorCb = null;
let settleMs = 120;
let scale = 1;
let uiTick = null;

export async function init({ ctx, uiTick: tick, settleMs: settle = 120 } = {}) {
  if (initialized) return;
  uiTick = tick;
  settleMs = settle;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e) => {
    const { type, payload } = e.data || {};
    if (type === 'result') {
      const { width, height, buffer } = payload;
      const data = new Uint8ClampedArray(buffer);
      const img = new ImageData(data, width, height);
      ctx.putImageData(img, 0, 0);
      if (typeof uiTick === 'function') uiTick();
    }
    if (type === 'error' && onErrorCb) onErrorCb(payload);
  });
  worker.addEventListener('error', (err) => onErrorCb && onErrorCb(err));
  initialized = true;
}

export function requestRender({ preview = false } = {}) {
  if (!initialized || !worker) return;
  const canvas = document.getElementById('canvas');
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  worker.postMessage({ type: 'render', payload: { width, height, preview: !!preview } });
}

export function setScale(s) {
  scale = Math.max(0.25, Math.min(2, s));
}

export function scheduleFullResRender(callback) {
  setTimeout(() => {
    requestRender({ preview: false });
    if (typeof callback === 'function') callback();
  }, settleMs);
}

export function terminate() {
  if (worker) worker.terminate();
  worker = null;
  initialized = false;
}

export function onError(cb) {
  onErrorCb = cb;
}

export function isInitialized() {
  return initialized;
}
