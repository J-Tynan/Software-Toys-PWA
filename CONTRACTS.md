# CONTRACTS

This document defines the **shared runtime contracts** that every software toy in this repository must follow. The goal is to guarantee interoperability between the shared UI, per‑toy modules, automated smoke tests, and contributor expectations. These contracts are intentionally implementation‑agnostic so they apply to all current and future toys (for example: Fractal Explorer, Particle Fountain, Audio Visualizer, Cellular Automata, Rotating Orb, Generative Landscape).

---

## Renderer Public API

All per‑toy `renderer.js` modules must export the following functions and meet the described behavior.

### Required exports and signatures

```js
// renderer.js
export async function init({ ctx, uiTick, settleMs }) { /* ... */ }
export function requestRender(renderDescriptor) { /* ... */ }
export function setScale(s) { /* ... */ }
export function scheduleFullResRender(callback) { /* ... */ }
export function terminate() { /* ... */ }
export function onError(cb) { /* ... */ }

---

### Behavioral requirements

- **init**
  - Must create or reuse a worker and attach message handlers.
  - Must accept `ctx` (CanvasRenderingContext2D), `uiTick` (function called each frame), and `settleMs` (milliseconds to treat preview as settled).
  - Must set an internal initialized flag and expose a way to query it for tests.

- **requestRender**
  - Accepts a single `renderDescriptor` object (see schema below).
  - Must support a low‑cost preview mode when `renderDescriptor.preview === true`.
  - Must post progress messages and return quickly for preview renders.

- **setScale**
  - Sets preview scale factor or accepts a function to update scale.

- **scheduleFullResRender**
  - Guarantees a full‑quality render after interaction settles.
  - Must be safe to call repeatedly.

- **terminate**
  - Must terminate worker and free resources.
  - Must be idempotent and safe to call multiple times.

- **onError**
  - Registers a callback invoked for fatal or recoverable renderer or worker errors.

---

## Generic Render Descriptor Schema

Use this single, toy‑agnostic object for `requestRender`. Toys may add toy‑specific fields inside `params.custom`.

```json
{
  "width": 800,
  "height": 600,
  "preview": false,
  "maxIter": 200,
  "paletteOffset": 0,
  "viewport": {
    "minX": -2.5,
    "maxX": 1.0,
    "minY": -1.2,
    "maxY": 1.2
  },
  "params": {
    "type": "string",
    "seed": null,
    "custom": {}
  }
}

### Notes

* 'viewport' is a generic coordinate box; toys that do not use coordinates may ignore or reinterpret it.

* 'params.custom' allows each toy to pass structured options without changing the contract.

---

## Worker Message Schema

Messages exchanged between the main thread and worker must be JSON‑serializable objects with a `type` field and a `payload` object. Transferable objects should be used for large data buffers wherever possible.

### Main to worker

- `{ type: "render", payload: { renderDescriptor } }`  
  Requests a render operation using the provided render descriptor.

- `{ type: "setParams", payload: { ... } }`  
  Updates worker parameters that affect subsequent renders (for example quality, iteration limits, or palette offsets).

- `{ type: "terminate" }`  
  Signals the worker to shut down and release resources.

### Worker to main

- `{ type: "progress", payload: { percent } }`  
  Reports incremental progress for long‑running renders. Progress messages must be throttled.

- `{ type: "result", payload: { width, height, buffer, meta } }`  
  Returns the completed render result. `buffer` should be a Transferable object such as an `ArrayBuffer` or `ImageBitmap`.

- `{ type: "error", payload: { message, code } }`  
  Reports a recoverable or fatal error encountered during rendering.

### Performance notes

- Use Transferable objects (`ArrayBuffer`, `ImageBitmap`) to avoid unnecessary copying.
- Progress messages should be throttled to prevent flooding the main thread.

### Suggested error codes

- `INIT_ERROR`
- `OOM`
- `RENDER_ERROR`
- `INVALID_PARAMS`

---

## UI Public API

The shared UI module (`shared/ui.js` or `ui-wiring.js`) must export the following functions and also attach them to `window.ui` for legacy compatibility.

### Required functions

- `createHeader(title)`  
  Creates and returns the fixed header element.

- `createFooter(opts)`  
  Creates and returns the fixed footer element. `opts` may include callbacks and extra controls.

- `createSettingsPanel(opts)`  
  Creates an off‑canvas settings panel. `opts` may include option lists, current selection, callbacks, and extra HTML. The panel **must** render a sticky header with a close button using id `close-settings`, and implementations must safely handle missing header controls (for example, the global header may lack a sound toggle).

- `createInfoModal(html, title)`  
  Creates and returns an informational modal dialog.

- `showToast(message, type)`  
  Displays a non‑blocking toast message. `type` is one of `info`, `success`, `warning`, or `error`.

- `setFpsEnabled(enabled)`  
  Enables or disables FPS display.

- `isFpsEnabled()`  
  Returns whether FPS display is enabled.

- `tickFrame()`  
  Called once per frame to update FPS counters.

### UI expectations

- Exactly one header element must exist with predictable class names.
- Exactly one footer element must exist with predictable class names.
- Settings panel must include a sticky header with a close button `#close-settings`; shared UI must guard DOM access for optional header controls (for example, `document.getElementById('settings-sound')` may return `null`).
- Toasts must be usable during startup errors and must not block interaction.
- Canvas layout must be sized between header and footer and re-measured on resize to avoid gaps.

### Footer UI height standards

All shared footers must use the shared control panel row standardizer in shared/ui.js.

- **Wrapper**: no extra padding on the footer container (use border only).
- **Row alignment**: each row is centered horizontally and vertically.
- **Button sizing**: buttons use `btn-xs` and `touch-target` for consistent height.

**Row padding by count**

- **1 row**: `py-2`
- **2 rows**: row 1 `py-2`, row 2 `py-1`
- **3 rows**: row 1 `py-2`, row 2 `py-1`, row 3 `py-2`

---

## Startup Self Test

In development builds, `main.js` must run a self‑test that verifies the environment before enabling interactive UI.

### Required checks

1. Exactly one header exists.
2. Exactly one footer exists.
3. A canvas element exists and is absolutely positioned.
4. CSS variables `--header-height` and `--footer-height` are set.
5. The renderer has been initialized and `requestRender` is callable.

### Failure handling

- Log a clear console error for each failed check.
- Show a non‑blocking toast describing the issue.
- If a check is fatal, show an informational modal with guidance and a link to the console.
- Avoid uncaught exceptions that block the UI.

### Required startup sequence

1. `createHeader(title)` and `createFooter(opts)`
2. `updateCanvasLayout()` or `bindCanvasLayout()` to compute header/footer heights and set CSS variables
3. `renderer.init({ ctx, uiTick, settleMs })`
4. `requestRender({ preview: false })`
5. Hide loading overlay and enable UI

### Shared canvas layout helpers

Use the shared helpers in `shared/ui.js` when sizing the canvas between the header and footer.

- `updateCanvasLayout(canvas)`
  - Computes header/footer heights, sets `--header-height` and `--footer-height`, and sizes the canvas.
- `bindCanvasLayout(canvas, { onResize })`
  - Calls `updateCanvasLayout()` immediately and when layout changes (window resize, fonts, header/footer resize).
  - Use `onResize` to trigger a re-render to avoid stale rows or black gaps after resize.

---

## Error Handling and Shortcuts

### Error handling

- Worker and renderer errors must be posted using `{ type: "error", payload }`.
- All registered `onError` callbacks must be invoked.
- Recoverable errors are shown as toasts.
- Fatal startup errors are shown as a modal with guidance and a link to the console.
- `terminate()` must be idempotent.

### Keyboard shortcuts

- A centralized keyboard shortcut registry must exist in `shared/ui.js` or `ui-wiring.js`.
- Example mapping:
  - `p` — toggle pause
  - `+` — zoom in
  - `-` — zoom out
  - `r` — reset
  - `d` — start demo mode
- Shortcuts must be documented in the README.
- Shortcuts must be ignored when focus is inside `input` or `textarea`.
- Per‑toy wiring may override or extend shortcuts.

---

## Testing Hooks and Versioning

### Testing hooks

Expose lightweight, development‑only hooks under `window.__TEST__`:

- `getHeaderCount()`
- `getFooterCount()`
- `isRendererInitialized()`
- `getCanvasComputedStyle()`

These hooks must be disabled or no‑ops in production builds.

Additional smoke-test expectations:
- `tests/smoke/header-sound.spec.js` — verifies toggling sound from Settings works when header sound toggle is missing.
- `tests/smoke/settings-close.spec.js` — verifies Settings panel has sticky header and `#close-settings` closes the panel.

### Versioning

- Maintain a `SHARED_API_VERSION` constant in shared code.
- Per‑toy code must check this version at startup and warn if incompatible.
- Bump the version for breaking changes and document them in this file.

Recent break: `SHARED_API_VERSION` bumped to `2.0` (breaking change): removed the header sound toggle and updated the Settings panel contract to require a sticky header with a `#close-settings` close button. Per‑toy code must use `shared/utils.js` settings helpers or guard access to optional header elements.

---

## Optional Features and Capability Flags

Optional features that toys may implement. Each toy must declare supported features in its README.

- **Preview rendering** — low‑cost preview mode for interactive gestures.
- **Export** — PNG export at configurable DPR with export limits and warnings.
- **Favorites** — save and restore view presets to `localStorage`.
- **Demo mode** — automated cycling through curated regions.
- **Audio input** — microphone access for audio‑driven toys.

---

## Migration Checklist for Each Toy

1. Implement `renderer.js` with the generic API and worker orchestration.
2. Implement `worker.js` following the message schema and using Transferables.
3. Implement `visualizations.js` for coordinate transforms and palettes.
4. Implement 'exporter.js' for exporting high-resolution screenshots.
5. Implement `ui-wiring.js` to create header and footer and wire controls.
6. Implement `main.js` to orchestrate startup and run the self‑test.
7. Add `styles.css` scoped to the toy and avoid global overrides.
8. Add `window.__TEST__` hooks for automated checks.
9. Run smoke tests and CI checks before merging.

---

## Example Error Message Format

```json
{
  "type": "error",
  "payload": {
    "code": "INIT_ERROR",
    "message": "Worker failed to start",
    "fatal": true
  }
}

---

## Governance and CI Recommendations

- Add a lightweight CI smoke test that loads each toy’s `index.html` headlessly and verifies the startup self‑test checklist (for example using Puppeteer or Playwright).
- Require a passing smoke test for all merges to the main branch.
- Keep `CONTRACTS.md` in the repository root as the single source of truth for shared behavior.
- Update `SHARED_API_VERSION` whenever a breaking change is introduced and document the change in this file.
- Encourage contributors to validate new or modified toys against the startup self‑test before opening a pull request.
- Document which optional features are supported by each toy in its individual README to set clear expectations.