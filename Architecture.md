# Architecture

## Overview

This document defines the file layout, separation of concerns, startup ordering, renderer and worker contracts, layout rules, and developer guidance for Joseph's Software Toys. It is intended to be a concise, actionable reference for contributors and for automated smoke tests.

---

## Project layout

**Root**

* `index.html` Homepage launcher
* `README.md`
* `screenshots/`



**Shared**

* `shared/ui.js` Header, footer, settings, toasts; exports ESM API and provides `window.ui` fallback
* `shared/utils.js` Theme, storage helpers, vibration/sound helpers, small math utilities
* `shared/styles-extra.css` Global layout and z-index rules



**Per toy (example fractal-explorer)**

* `index.html` Toy entry (loads `main.js` as module)
* `main.js` App orchestration and startup checklist
* `ui-wiring.js` Thin adapter between shared UI and toy state
* `renderer.js` Worker orchestration and public renderer API
* `worker.js` Heavy compute for rendering
* `visualizations.js` Canvas helpers and coordinate transforms
* `exporter.js` Computes and exports high-resolution screenshots of render.
* `styles.css` Toy-specific CSS
* `manifest.json` and `service-worker.js` Per-toy PWA artifacts
* `assets/` Icons and previews

---

## Startup ordering checklist

Every `main.js` must follow this exact sequence on startup:

1. Call `ui.createHeader(title)` and `ui.createZoomFooter(opts)` to create header and footer.
2. Call `updateCanvasLayout()` to compute header/footer heights and set canvas `top` and `bottom`.
3. Initialize renderer with `renderer.init({ ctx, uiTick, settleMs })`.
4. Call `requestRender({ preview: false })` for the first full render.
5. Hide the loading overlay and enable UI interactions.

Include a dev-only self-test that asserts each step completed and logs a clear error if not.

---

## Layout and z-index rules

**CSS rules to include in shared/styles-extra.css**

```css
div.fixed.top-0 { position: fixed; top: 0; left: 0; right: 0; z-index: 20; }
div.fixed.bottom-0 { position: fixed; bottom: 0; left: 0; right: 0; z-index: 20; }
#canvas {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--header-height, 0);
  bottom: var(--footer-height, 0);
  z-index: 0;
  touch-action: none;
}
html, body { height: 100%; margin: 0; }
```
---

## Event ownership rules
* Attach pointer and wheel handlers only to the canvas.
* Use '{ passive: false }' for wheel listeners so 'preventDefault()' works.
* Input semantics:
* Single pointer = pan preview
* Two pointers = pinch preview
* Double-tap = zoom in
* Preview renders must be low-cost; commit to full render via 'scheduleFullResRender()'.

---

## Service worker guidance
* Dev mode: disable SW to avoid stale files during refactor.
* Production: precache `index.html`, `main.js`, `shared/*`, and essential assets.
* Update UX: show a non-blocking toast when a new SW is available with an optional Reload action.

---

## Testing and CI
* Add a smoke test that verifies:
** Header exists and count is 1
** Canvas top and bottom are set from computed header/footer heights
** Worker created once
** Wheel handler attached to canvas
* Run lint and smoke tests on PRs.

Local smoke test runner:

- Start a local static server at the repo root: `npm run serve` (uses `http-server` on port 8000)
- Run the smoke tests once the server is up: `npm run test:smoke`

CI:

- A GitHub Actions workflow `smoke-tests.yml` runs on pushes and PRs to `main` and executes the smoke tests headlessly.

---

##Accessibility
* Header buttons must include aria-label.
* Canvas should include role="application" and a short accessible description.
* Keyboard shortcuts registry should be centralized and documented (example: P = pause).

---

## Developer notes
* Use ESM named exports in `shared/*` and per-toy modules.
* Keep `window.*` fallbacks only for legacy compatibility.
* Enforce consistent import paths: per-toy modules import shared modules with `../shared/...`.