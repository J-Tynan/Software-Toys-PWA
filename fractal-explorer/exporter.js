// Exporter module
// Responsibilities:
// - initExporter({ ui, getState, workerPath, workerFactory, maxDim })
// - exportScreenshot({ quality, embedMeta, autoDownload, filename, onProgress }) -> Promise<{ blob, metadata }>
// - embedPngITXt(arrayBuffer, keyword, text) -> ArrayBuffer (pure, exportable for tests)

let _ui = null;
let _getState = null;
let _workerPath = './fractal-worker.js';
let _workerFactory = null;
let _maxDim = 8000;
let _isExporting = false;
let _currentWorker = null;

export function initExporter({ ui, getState, workerPath = './fractal-worker.js', workerFactory = null, maxDim = 8000 } = {}) {
  _ui = ui || null;
  _getState = getState || null;
  _workerPath = workerPath;
  _workerFactory = workerFactory;
  _maxDim = maxDim || 8000;
}

export function cancelCurrentExport() {
  if (!_isExporting) return false;
  try {
    if (_currentWorker && typeof _currentWorker.terminate === 'function') _currentWorker.terminate();
  } finally {
    _isExporting = false;
    _currentWorker = null;
  }
  if (_ui && _ui.showToast) _ui.showToast('Export cancelled', 'info');
  return true;
}

export async function exportScreenshot({ quality, embedMeta = true, autoDownload = true, filename, onProgress } = {}) {
  if (_isExporting) throw new Error('Export already in progress');
  if (!_getState) throw new Error('Exporter not initialized (missing getState)');

  _isExporting = true;

  try {
    if (_ui && _ui.showToast) _ui.showToast('Preparing high-quality export...', 'info');

    const state = _getState();
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));

    const q = quality || localStorage.getItem('exportQuality') || 'hd';
    let exportScale = 1;
    if (q === 'hd') exportScale = dpr;
    else if (q === 'ultra') exportScale = Math.min(4, dpr * 2);
    else if (q === 'ultra4') exportScale = 4;

    let targetW = Math.max(1, Math.floor((state.width || 1) * exportScale));
    let targetH = Math.max(1, Math.floor((state.height || 1) * exportScale));

    if (targetW > _maxDim || targetH > _maxDim) {
      const scaleFactor = Math.min(_maxDim / targetW, _maxDim / targetH);
      targetW = Math.max(1, Math.floor(targetW * scaleFactor));
      targetH = Math.max(1, Math.floor(targetH * scaleFactor));
      if (_ui && _ui.showToast) _ui.showToast('Export downscaled for performance', 'warn');
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const ectx = exportCanvas.getContext('2d', { alpha: false });

    // Create dedicated worker
    const worker = _workerFactory ? _workerFactory() : new Worker(_workerPath);
    _currentWorker = worker;

    const receivedBands = new Set();
    let rowsAccum = 0;

    return await new Promise((resolve, reject) => {
      const onMessage = async (ev) => {
        const { id: rid, width: w, height: h, yStart, bandHeight, buffer } = ev.data || {};
        if (w !== targetW || h !== targetH) return;

        try {
          const pixels = new Uint8ClampedArray(buffer);
          const img = new ImageData(pixels, w, bandHeight);
          ectx.putImageData(img, 0, yStart);

          const key = `${yStart}:${bandHeight}`;
          if (!receivedBands.has(key)) {
            receivedBands.add(key);
            rowsAccum += bandHeight;
          }

          if (typeof onProgress === 'function') {
            onProgress({ rowsAccum, totalRows: h });
          }

          if (rowsAccum >= h) {
            worker.removeEventListener('message', onMessage);
            setTimeout(async () => {
              try {
                const blob = await new Promise((res) => exportCanvas.toBlob(res, 'image/png'));
                if (!blob) {
                  reject(new Error('Export failed (no blob)'));
                  try { worker.terminate(); } catch (e) {}
                  _isExporting = false;
                  _currentWorker = null;
                  return;
                }

                const zoom = (state.initialReWidth / (state.maxRe - state.minRe)) || 1;
                const meta = {
                  fractal: state.currentFractalType,
                  zoom: Number((zoom || 1).toFixed(2)),
                  bounds: { minRe: state.minRe, maxRe: state.maxRe, minIm: state.minIm, maxIm: state.maxIm },
                  maxIter: state.maxIter, juliaCr: state.juliaCr, juliaCi: state.juliaCi, paletteOffset: state.paletteOffset
                };

                const base = filename || `${state.currentFractalType}-${meta.zoom}x`;
                const fname = `${base}.png`;

                if (embedMeta) {
                  try {
                    const ab = await blob.arrayBuffer();
                    const newAb = embedPngITXt(ab, 'FractalMeta', JSON.stringify(meta));
                    const newBlob = new Blob([newAb], { type: 'image/png' });

                    if (autoDownload) {
                      const url = URL.createObjectURL(newBlob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fname;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      if (_ui && _ui.showToast) _ui.showToast('Export saved (PNG with metadata)', 'success');
                    }

                    resolve({ blob: newBlob, metadata: meta });
                  } catch (err) {
                    console.error('Embedding metadata failed', err);
                    // Fallback: download raw PNG and separate metadata file if autoDownload
                    if (autoDownload) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fname;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);

                      const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
                      const metaUrl = URL.createObjectURL(metaBlob);
                      const am = document.createElement('a');
                      am.href = metaUrl;
                      am.download = `${base}.json`;
                      document.body.appendChild(am);
                      am.click();
                      am.remove();
                      URL.revokeObjectURL(metaUrl);

                      if (_ui && _ui.showToast) _ui.showToast('Export saved (metadata separate)', 'warn');
                    }

                    resolve({ blob, metadata: meta });
                  }
                } else {
                  if (autoDownload) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fname;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    if (_ui && _ui.showToast) _ui.showToast('Export saved (PNG)', 'success');
                  }
                  resolve({ blob, metadata: meta });
                }
              } catch (ex) {
                reject(ex);
              } finally {
                try { worker.terminate(); } catch (e) {}
                _isExporting = false;
                _currentWorker = null;
              }
            }, 20);
          }
        } catch (err) {
          reject(err);
          try { worker.terminate(); } catch (e) {}
          _isExporting = false;
          _currentWorker = null;
        }
      };

      worker.addEventListener('message', onMessage);

      // Start render
      worker.postMessage({
        id: 'export',
        width: targetW,
        height: targetH,
        minRe: state.minRe,
        maxRe: state.maxRe,
        minIm: state.minIm,
        maxIm: state.maxIm,
        maxIter: state.maxIter,
        fractalType: state.currentFractalType,
        juliaCr: state.juliaCr,
        juliaCi: state.juliaCi,
        paletteOffset: state.paletteOffset
      });
    });

  } finally {
    // ensure flag reset if something threw synchronously
    _isExporting = false;
    _currentWorker = null;
  }
}

// Pure: embed UTF-8 metadata into PNG ArrayBuffer using an iTXt chunk
export function embedPngITXt(arrayBuffer, keyword, text) {
  const dv = new DataView(arrayBuffer);
  const chunks = [];
  let offset = 8; // skip signature
  while (offset < dv.byteLength) {
    const len = dv.getUint32(offset, false);
    const type = String.fromCharCode(
      dv.getUint8(offset + 4), dv.getUint8(offset + 5), dv.getUint8(offset + 6), dv.getUint8(offset + 7)
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    const crcStart = dataEnd;
    const crcEnd = crcStart + 4;
    chunks.push({ type, offset, len, dataStart, dataEnd, crcStart, crcEnd });
    offset = crcEnd;
    if (type === 'IEND') break;
  }

  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);
  const parts = [];
  parts.push(keywordBytes);
  parts.push(new Uint8Array([0])); // null separator
  parts.push(new Uint8Array([0])); // compression flag 0
  parts.push(new Uint8Array([0])); // compression method 0
  parts.push(new Uint8Array([0])); // empty language tag + null
  parts.push(new Uint8Array([0])); // empty translated keyword + null
  parts.push(textBytes);

  let dataLen = 0;
  for (const p of parts) dataLen += p.length;
  const itxt = new Uint8Array(dataLen);
  let pos = 0;
  for (const p of parts) { itxt.set(p, pos); pos += p.length; }

  const typeBytes = encoder.encode('iTXt');
  const chunkLen = itxt.length;
  const chunkBuffer = new ArrayBuffer(8 + chunkLen + 4);
  const chunkDv = new DataView(chunkBuffer);
  chunkDv.setUint32(0, chunkLen, false);
  for (let i = 0; i < 4; i++) chunkDv.setUint8(4 + i, typeBytes[i]);
  const chunkUint8 = new Uint8Array(chunkBuffer);
  chunkUint8.set(itxt, 8);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const crcTable = (function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  const crcBuf = new Uint8Array(4 + itxt.length);
  crcBuf.set(typeBytes, 0);
  crcBuf.set(itxt, 4);
  const crc = crc32(crcBuf);
  chunkDv.setUint32(8 + chunkLen, crc, false);

  const iendChunk = chunks.find(c => c.type === 'IEND');
  if (!iendChunk) return arrayBuffer;

  const beforeIend = new Uint8Array(arrayBuffer, 0, iendChunk.offset);
  const iendAndAfter = new Uint8Array(arrayBuffer, iendChunk.offset);

  const out = new Uint8Array(beforeIend.length + chunkBuffer.byteLength + iendAndAfter.length);
  let o = 0;
  out.set(beforeIend, o); o += beforeIend.length;
  out.set(new Uint8Array(chunkBuffer), o); o += chunkBuffer.byteLength;
  out.set(iendAndAfter, o);

  return out.buffer;
}
