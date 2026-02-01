// Minimal renderer implementation following CONTRACTS.md
export let isInitialized = false;
let ctxRef = null;
let onErrorCb = null;

export async function init({ ctx, uiTick, settleMs }) {
  isInitialized = true;
  ctxRef = ctx;
  // Draw a faint grid to show canvas is ready
  if (ctxRef) {
    ctxRef.fillStyle = '#f8fafc';
    ctxRef.fillRect(0, 0, ctxRef.canvas.width, ctxRef.canvas.height);
  }
  return Promise.resolve();
}

export function requestRender({ width, height, preview = false } = {}) {
  if (!ctxRef) return;
  const w = width || ctxRef.canvas.width;
  const h = height || ctxRef.canvas.height;
  ctxRef.clearRect(0, 0, w, h);
  // Simple visual: diagonal lines
  ctxRef.fillStyle = '#ffffff';
  ctxRef.fillRect(0, 0, w, h);
  ctxRef.strokeStyle = '#e6e6e6';
  for (let i = 0; i < w; i += 20) {
    ctxRef.beginPath();
    ctxRef.moveTo(i, 0);
    ctxRef.lineTo(0, i);
    ctxRef.stroke();
  }
}

export function setScale(s) { /* no-op for test */ }
export function scheduleFullResRender(cb) { if (typeof cb === 'function') setTimeout(cb, 50); }
export function terminate() { isInitialized = false; ctxRef = null; }
export function onError(cb) { onErrorCb = cb; }
