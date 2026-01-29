const { test, expect } = require('@playwright/test');

// These tests expect a local static server serving repository root at http://localhost:8000
const BASE = 'http://localhost:8000/fractal-explorer/index.html';

test.describe('Fractal Explorer startup', () => {
  test('startup self-test checks header/footer/canvas and css vars', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#canvas');

    const hdrCount = await page.evaluate(() => (window.__TEST__ && typeof window.__TEST__.getHeaderCount === 'function') ? window.__TEST__.getHeaderCount() : document.querySelectorAll('.fixed.top-0').length);
    const ftrCount = await page.evaluate(() => (window.__TEST__ && typeof window.__TEST__.getFooterCount === 'function') ? window.__TEST__.getFooterCount() : document.querySelectorAll('.fixed.bottom-0').length);

    expect(hdrCount).toBe(1);
    expect(ftrCount).toBe(1);

    const cs = await page.evaluate(() => (window.__TEST__ && typeof window.__TEST__.getCanvasComputedStyle === 'function') ? window.__TEST__.getCanvasComputedStyle() : (() => { const c = document.getElementById('canvas'); return c ? { position: getComputedStyle(c).position } : null; })());
    expect(cs).not.toBeNull();
    expect(cs.position).toBe('absolute');

    const headerH = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--header-height'));
    const footerH = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--footer-height'));
    expect(headerH && headerH.trim().length > 0).toBeTruthy();
    expect(footerH && footerH.trim().length > 0).toBeTruthy();
  });
});