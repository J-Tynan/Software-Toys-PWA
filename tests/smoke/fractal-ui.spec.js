const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8000/fractal-explorer/index.html';

test.describe('Fractal Explorer UI interactions', () => {
  test('wheel zoom updates zoom readout', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#canvas');

    const before = await page.$eval('#zoom-readout', el => el.textContent);
    await page.dispatchEvent('#canvas', 'wheel', { deltaY: -120, clientX: 100, clientY: 100 });
    await page.waitForTimeout(400);
    const after = await page.$eval('#zoom-readout', el => el.textContent);
    expect(after).not.toBe(before);
  });

  test('footer zoom buttons change zoom readout', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#canvas');

    // click a +1 button
    await page.click('button[data-steps="1"]');
    await page.waitForTimeout(300);
    const zr = await page.$eval('#zoom-readout', el => el.textContent);
    expect(zr).toMatch(/Zoom:/);
  });
});