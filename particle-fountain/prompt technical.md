Create a **scaffolded PWA skeleton** for a new software toy called **Particle Fountain** that follows the project's shared architecture and CONTRACTS. Output a file tree and create the following files with minimal, well-documented starter code and TODO markers so developers can iterate quickly.

**Goal:** produce a ready-to-edit scaffold under `software-toys-pwa/particle-fountain/`that:
- Uses the shared UI and utils (`../shared/ui.js`, `../shared/utils.js`, `../shared/styles-extra.css`).
- Matches the Fractal Explorer header, settings panel and footer visuals.
- The footer UI for this software toy will be 2 rows tall. The 1st row contains the following controls: "0.25x", "0.5x", "0.75x", "1x", "Play"/"Pause". The 2nd row will contain status messages about the 1st row.
- Implements the required startup sequence and exposes test hooks per CONTRACTS.md.
- Provides a demo-mode callback placeholder and a simple "paused / speed" playback control wiring example.
- Is accessible and PWA-ready (manifest + service worker stub).
- Includes clear TODOs and comments for implementers.

**Files to create (with content):**
1. `index.html`
   - Minimal PWA entry that loads Tailwind + DaisyUI CDN, `../shared/styles-extra.css`, `../shared/utils.js`, `../shared/ui.js`.
   - Loads `main.js` as `type="module"`.
   - Contains `#loading-overlay`, a `<canvas id="canvas" role="application" aria-label="Particle Fountain canvas">`, and a small fallback message.
   - Registers `service-worker.js` if available.
   - TODO comments for icons and manifest.

2. `main.js` (ESM)
   - Implements the **startup checklist** from Architecture.md / CONTRACTS.md in order:
     1. `ui.createHeader('Particle Fountain')`
     2. `ui.createFooter(opts)` if generic footer is used
     3. `updateCanvasLayout()` to compute header/footer heights and set CSS vars
     4. `renderer.init({ ctx, uiTick, settleMs })`
     5. `renderer.requestRender({ preview: false })`
     6. Hide loading overlay and enable UI
   - Wire header buttons:
     - `Demo` button → call `onDemo()` placeholder exported from `ui-wiring.js` or provided by toy.
     - `Reset`, `Fullscreen`, `Info`, `Theme`, `Sound` wired to shared UI where appropriate.
   - Create canvas sizing logic that reads header/footer heights and sets `--header-height` and `--footer-height` CSS vars.
   - Attach pointer/wheel handlers to canvas only (passive: false for wheel).
   - Initialize exporter stub (if desired) and add an `Export` header button placeholder.
   - Expose `window.__TEST__` hooks: `getHeaderCount()`, `getFooterCount()`, `isRendererInitialized()`, `getCanvasComputedStyle()`.
   - Add dev-only self-test that verifies the startup checklist and shows toasts/modal on failure (non-blocking).

3. `ui-wiring.js`
   - Thin adapter that wires toy-specific callbacks into the shared UI:
     - Exports `attachToyUi({ onDemo, onReset, onInfo })`.
     - When called, and wires them to the provided callbacks.
     - Ensures graceful behavior if shared header controls are missing (guard DOM access).
     - Exposes `createToySettingsPanel(opts)` that calls `ui.createSettingsPanel(...)` with `extraHtml` for toy-specific controls.

4. `renderer.js`
   - Export the renderer public API per CONTRACTS.md:
     - `export async function init({ ctx, uiTick, settleMs }) { ... }`
     - `export function requestRender(renderDescriptor) { ... }`
     - `export function setScale(s) { ... }`
     - `export function scheduleFullResRender(callback) { ... }`
     - `export function terminate() { ... }`
     - `export function onError(cb) { ... }`
   - Implement a minimal worker orchestration that creates a Worker (`worker.js`) and forwards messages using the `{ type, payload }` envelope.
   - Implement preview vs full render flags and ensure `requestRender` returns quickly for preview.
   - Expose an `initialized` flag and a `isInitialized()` helper for tests.

5. `worker.js`
   - Worker skeleton that listens for `{ type: 'render' }`, `{ type: 'setParams' }`, `{ type: 'terminate' }`.
   - For now, implement a **fast placeholder render**: fill a transferable `ImageData` or `ArrayBuffer` with a simple gradient or particle preview and post `{ type: 'result', payload: { width, height, yStart, bandHeight, buffer } }`.
   - Post periodic `{ type: 'progress', payload: { percent } }` messages for long renders.
   - Handle `terminate` and cleanup.

6. `visualizations.js` (optional)
   - Helpers for coordinate transforms, particle system utilities, and a `drawParticles(ctx, particles)` helper used by renderer or main thread.

7. `styles.css`
   - Toy-specific CSS: position canvas absolute; mobile touch-target helpers; any small visual tweaks.
   - Keep global z-index and layout rules in `../shared/styles-extra.css` only.

8. `manifest.json` (toy-specific)
   - Minimal PWA manifest with `name`, `short_name`, `start_url`, `display`, `background_color`, `theme_color`, and an `icons` array (placeholder paths).

9. `service-worker.js`
   - Simple cache-first or network-first stub similar to Fractal Explorer's service worker with `CACHE_NAME` and `urlsToCache`.
   - Include a TODO comment about dev-mode disabling.

10. `README.md` (toy folder)
    - Short instructions: how to run locally (`npm run serve`), where to implement particle logic, Demo callbacks, and how to run smoke tests.

11. `tests/selftest.js` (dev-only)
    - Lightweight script that runs in-browser to assert the startup checklist and exposes results in console and via `ui.showToast()`.

**Implementation details & constraints for Raptor Mini:**
- Use ESM imports and named exports.
- Import shared modules with relative paths: `../shared/ui.js`, `../shared/utils.js`.
- Use Tailwind + DaisyUI classes for UI elements (buttons, toggles, modal).
- Keep all shared UI DOM queries guarded (e.g., `document.getElementById('sound-toggle')` may be null).
- Add `SHARED_API_VERSION = '2.0'` check in `main.js` and warn if mismatch.
- Add clear `// TODO` markers where toy-specific particle logic must be implemented (e.g., particle update loop, spawn heights, seed handling).
- Ensure accessibility: header buttons include `aria-label`, canvas has `role="application"` and `aria-describedby` linking to a short description element.
- Expose `window.__TEST__` hooks and ensure they are no-ops in production (wrap in `if (location.hostname === 'localhost' || location.protocol === 'http:')` or a `DEV` flag).
- Keep code well-commented and modular so maintainers can replace placeholder worker logic with a real particle renderer later.

**Deliverable format (single response):**
- Output a compact file tree listing the files to be created.
- For each file, include a short code stub (2–40 lines) showing the exact top-level structure, imports, exported functions, and TODO comments.
- Use clear inline comments describing where to implement particle logic, demo sequences, and worker rendering.
- Do not implement full particle physics — only scaffolding and contracts compliance.

**Example file tree to create:**
particle-fountain/
├─ index.html
├─ main.js
├─ ui-wiring.js
├─ renderer.js
├─ worker.js
├─ visualizations.js
├─ styles.css
├─ manifest.json
├─ service-worker.js
├─ README.md
├─ tests/
│  └─ selftest.js
├─ particles/
│  └─ aurora.js
│  └─ confetti.js
│  └─ fireworks.js


Begin by generating the file tree and the starter code stubs for each file as described above. Keep the code minimal, correct, and clearly annotated with TODOs so a developer can open the folder in VS Code.