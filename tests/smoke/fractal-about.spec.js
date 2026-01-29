const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8000/fractal-explorer/index.html';

test('Info modal opens and contains content', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForSelector('#info-btn');
  await page.click('#info-btn');
  // Modal present
  const modal = await page.waitForSelector('dialog.modal');
  const content = await modal.innerText();
  expect(content.length).toBeGreaterThan(10);
});