// Minimal Playwright config for smoke tests
module.exports = {
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
};