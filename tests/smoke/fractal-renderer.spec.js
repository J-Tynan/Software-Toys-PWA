const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8000/fractal-explorer/index.html';

test.describe('Fractal Explorer renderer', () => {
  test('renderer emits at least one result within 5s', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#canvas');

    // wait for worker result counter to increment or for waitForResult hook
    const ok = await page.evaluate(() => {
      if (window.__TEST__ && typeof window.__TEST__.waitForResult === 'function') {
        return window.__TEST__.waitForResult(5000).then(() => true).catch(() => false);
      }
      // Fallback: poll workerResults counter
      return new Promise(resolve => {
        const start = Date.now();
        const iv = setInterval(() => {
          if ((window.__TEST__ && window.__TEST__.workerResults || 0) > 0) { clearInterval(iv); resolve(true); }
          else if (Date.now() - start > 5000) { clearInterval(iv); resolve(false); }
        }, 100);
      });
    });

    expect(ok).toBeTruthy();
  }, 10000);
});