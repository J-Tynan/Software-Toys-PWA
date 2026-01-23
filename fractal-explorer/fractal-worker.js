// fractal-worker.js
// High-performance fractal renderer (Web Worker)
//
// Features implemented:
// - Supports multiple fractal types: Mandelbrot, Julia, Burning Ship
// - Progressive rendering in horizontal scanline bands (responsive feel)
// - Cancellation-safe via render id (main thread ignores stale ids)
// - Palette-based coloring (fast) + smooth escape-time coloring (optional, enabled by default)
//
// Message in (from main thread):
//   {
//     id, width, height,
//     minRe, maxRe, minIm, maxIm,
//     maxIter,
//     fractalType: 'mandelbrot' | 'julia' | 'burningShip',
//     juliaCr, juliaCi
//   }
//
// Message out (to main thread), progressive:
//   { id, width, height, yStart, bandHeight, buffer }
//
// The buffer is an ArrayBuffer containing RGBA pixels for JUST that band:
//   bandHeight * width * 4 bytes

let palette = null;
let paletteSize = 0;
let paletteOffsetLast = null;

// Tuning knobs
const BAND_HEIGHT = 32;          // rows per progressive chunk (16/32/64 are good options)
const SMOOTH_COLORING = true;    // smooth escape-time coloring

function buildPalette(maxIter, paletteOffset = 0) {
  // Rebuild palette when maxIter changes OR paletteOffset shifts
  if (palette && paletteSize === maxIter && paletteOffsetLast === paletteOffset) return;

  paletteSize = maxIter;
  paletteOffsetLast = paletteOffset;
  palette = new Uint8ClampedArray(maxIter * 3);

  for (let i = 0; i < maxIter; i++) {
    // Apply paletteOffset as a phase shift in the normalized t in [0,1)
    const t = (i / maxIter + paletteOffset) % 1;

    // Cosine palette (fast, pretty, smooth)
    const r = Math.floor(128 + 127 * Math.cos(6.283185307179586 * (t + 0.00)));
    const g = Math.floor(128 + 127 * Math.cos(6.283185307179586 * (t + 0.33)));
    const b = Math.floor(128 + 127 * Math.cos(6.283185307179586 * (t + 0.67)));

    const idx = i * 3;
    palette[idx] = r;
    palette[idx + 1] = g;
    palette[idx + 2] = b;
  }
}

function writeColor(buffer, outIdx, iter, tFrac, maxIter) {
  // Inside set
  if (iter >= maxIter) {
    buffer[outIdx] = 0;
    buffer[outIdx + 1] = 0;
    buffer[outIdx + 2] = 0;
    buffer[outIdx + 3] = 255;
    return;
  }

  // Smooth palette interpolation: iter + fractional component
  const i0 = iter;
  const i1 = (i0 + 1) < maxIter ? (i0 + 1) : i0;

  const p0 = i0 * 3;
  const p1 = i1 * 3;

  const r = palette[p0] + (palette[p1] - palette[p0]) * tFrac;
  const g = palette[p0 + 1] + (palette[p1 + 1] - palette[p0 + 1]) * tFrac;
  const b = palette[p0 + 2] + (palette[p1 + 2] - palette[p0 + 2]) * tFrac;

  buffer[outIdx] = r | 0;
  buffer[outIdx + 1] = g | 0;
  buffer[outIdx + 2] = b | 0;
  buffer[outIdx + 3] = 255;
}

// Returns { iter, zRe, zIm } where z is the last value (used for smooth coloring)
function iteratePoint(fractalType, cRe, cIm, maxIter, juliaCr, juliaCi) {
  let zRe, zIm;
  let constRe, constIm;

  if (fractalType === 'julia') {
    // Julia: z0 = pixel, c = user constant
    zRe = cRe;
    zIm = cIm;
    constRe = juliaCr;
    constIm = juliaCi;
  } else {
    // Mandelbrot / Burning Ship: z0 = pixel (common variant), c = pixel
    zRe = cRe;
    zIm = cIm;
    constRe = cRe;
    constIm = cIm;
  }

  let iter = 0;
  while (iter < maxIter) {
    // Bailout check
    const zr2 = zRe * zRe;
    const zi2 = zIm * zIm;
    if (zr2 + zi2 > 4) break;

    // Burning Ship uses abs() before the square
    if (fractalType === 'burningShip') {
      zRe = Math.abs(zRe);
      zIm = Math.abs(zIm);
    }

    // z = z^2 + c
    const newRe = zRe * zRe - zIm * zIm + constRe;
    const newIm = 2 * zRe * zIm + constIm;
    zRe = newRe;
    zIm = newIm;

    iter++;
  }

  return { iter, zRe, zIm };
}

// Smooth escape-time fraction based on final |z|
// μ = n + 1 - log(log|z|)/log 2
function smoothFraction(iter, zRe, zIm) {
  // If it didn't escape, no smoothing
  const mag2 = zRe * zRe + zIm * zIm;
  if (mag2 <= 0) return 0;

  // log|z| = 0.5*log(mag2)
  const log_zn = 0.5 * Math.log(mag2);
  if (!isFinite(log_zn) || log_zn <= 0) return 0;

  const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
  const mu = iter + 1 - nu;

  // Convert μ to fractional part for palette interpolation
  const frac = mu - Math.floor(mu);
  if (!isFinite(frac)) return 0;
  return Math.max(0, Math.min(1, frac));
}

self.onmessage = (e) => {
  const {
    id,
    width,
    height,
    minRe,
    maxRe,
    minIm,
    maxIm,
    maxIter,
    fractalType = 'mandelbrot',
    juliaCr = -0.8,
    juliaCi = 0.156
  } = e.data || {};

  if (!id || !width || !height || !maxIter) return;

  buildPalette(maxIter, e.data.paletteOffset);

  const reFactor = (maxRe - minRe) / (width - 1);
  const imFactor = (maxIm - minIm) / (height - 1);

  // Render progressively in horizontal bands
  for (let yStart = 0; yStart < height; yStart += BAND_HEIGHT) {
    const bandHeight = Math.min(BAND_HEIGHT, height - yStart);
    const band = new Uint8ClampedArray(width * bandHeight * 4);

    for (let by = 0; by < bandHeight; by++) {
      const y = yStart + by;
      const cIm = minIm + y * imFactor;

      for (let x = 0; x < width; x++) {
        const cRe = minRe + x * reFactor;

        const { iter, zRe, zIm } = iteratePoint(
          fractalType,
          cRe,
          cIm,
          maxIter,
          juliaCr,
          juliaCi
        );

        const outIdx = (by * width + x) * 4;

        if (iter >= maxIter) {
          band[outIdx] = 0;
          band[outIdx + 1] = 0;
          band[outIdx + 2] = 0;
          band[outIdx + 3] = 255;
        } else {
          let tFrac = 0;
          if (SMOOTH_COLORING) {
            tFrac = smoothFraction(iter, zRe, zIm);
          }
          writeColor(band, outIdx, iter, tFrac, maxIter);
        }
      }
    }

    // Post this band back (transfer the buffer)
    self.postMessage(
      { id, width, height, yStart, bandHeight, buffer: band.buffer },
      [band.buffer]
    );
  }
};
