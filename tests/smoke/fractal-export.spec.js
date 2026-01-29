const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8000/fractal-explorer/index.html';

test('Export button shows preparing toast', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForSelector('#export-btn');
  await page.click('#export-btn');
  // Toast appears with 'Preparing' text
  const toast = await page.locator('text=Preparing high-quality export...').first();
  await expect(toast).toBeVisible();
});