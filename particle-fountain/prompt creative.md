You are GPT-5.2-Codex running inside VS Code (Raptor Mini). I want you to generate a complete scaffolding for a new software toy called **Particle Fountain** that follows our shared architecture and UI contracts. Produce files and minimal starter code (no heavy rendering logic) so a developer can open the project and run the toy, wire the renderer later, and run smoke tests. Keep everything ESM, use the shared UI (`../shared/ui.js`) and utilities (`../shared/utils.js`), and follow the startup ordering and CONTRACTS in `CONTRACTS.md` and `Architecture.md`.

--- Requirements (high level)
1. **Creative brief (what the toy shows):**
   - Perspective: *looking up at the night sky* from ground level.
   - Three particle fountains at three different heights (low, mid, high). Each fountain uses a distinct particle style (e.g., sparkles, glows, streaks).
   - Particles rise upward from each fountain, affected by gravity and wind; they fade and fall back or dissipate.
   - Background: starry night gradient; optional parallax stars.
   - UI: header, settings panel, footer must use shared UI primitives and match Fractal Explorer visuals and behavior.
   - Interactions: pan/zoom not required (canvas is fixed looking up). Interactions are controls: Play/Pause, Speed, Demo, Reset, Save, Load, Export (optional). Save/Load are toy-defined behaviors but UI visuals come from shared UI.

2. **Functional contracts to obey**
   - Call `ui.createHeader(title)` and `ui.createZoomFooter(opts)` on startup.
   - Use `ui.createSettingsPanel(opts)` for settings; include `#close-settings`.
   - Implement `renderer.js` with the public API described in `CONTRACTS.md` (stubs are fine): `init({ ctx, uiTick, settleMs })`, `requestRender(descriptor)`, `setScale(s)`, `scheduleFullResRender(cb)`, `terminate()`, `onError(cb)`.
   - Worker message envelope must follow `{ type, payload }` schema. Provide a minimal `worker.js` that responds to `render` and `terminate` messages (no heavy compute).
   - Provide `ui-wiring.js` as a thin adapter that wires header buttons (Demo, Reset, Save, Load, Settings, Info) to toy callbacks.
   - Provide `main.js` that orchestrates startup in the exact sequence from `Architecture.md` and runs a dev self-test (window.__TEST__ hooks).
   - Expose `window.__TEST__` hooks: `getHeaderCount()`, `getFooterCount()`, `isRendererInitialized()`, `getCanvasComputedStyle()` (no-ops in production).
   - Accessibility: header buttons include `aria-label`; canvas has `role="application"` and a short accessible description.

3. **Files to generate**
   - `index.html` (toy entry) — loads `../shared/utils.js`, `../shared/ui.js`, applies theme, loads `ui-wiring.js` and `main.js` as module.
   - `styles.css` — toy-specific styles (starry background, canvas sizing).
   - `main.js` — orchestrator (startup sequence, canvas layout, init renderer, request first render, hide loading overlay).
   - `ui-wiring.js` — wires shared UI to toy callbacks; registers Save/Load hooks (exposes `window.toySave` and `window.toyLoad` placeholders).
   - `renderer.js` — exports required renderer API; uses a Worker (`worker.js`) and implements message handling; stubbed rendering that paints a placeholder sky and calls `ui.tickFrame()`; supports preview flag.
   - `worker.js` — minimal worker that accepts `{ type: 'render', payload }` and posts back `{ type: 'result', payload: { width, height, buffer } }` with a tiny generated ImageData or a simple status message. Also handle `{ type: 'terminate' }`.
   - `manifest.json` and `service-worker.js` — minimal PWA artifacts (service worker should be safe for dev).
   - `README.md` — short instructions to run and where to implement rendering logic.
   - `assets/` placeholder (no binary files required).

4. **Behavioral details & UI wiring**
   - Header: Title "Particle Fountain"; left: Home, Demo; center: title; right: Reset, Save, Load, Fullscreen, Info, Theme toggle, Sound toggle, Settings.
   - Demo button: toy provides `startDemo()` and `stopDemo()` functions; `ui-wiring.js` should call toy-provided callbacks if present.
   - Save/Load: `ui-wiring.js` renders Save and Load buttons visually; when clicked, call `window.toySave()` / `window.toyLoad(file)` if defined by the toy. Provide a simple file download helper in `ui-wiring.js` and a file input for load.
   - Settings panel: include toggles for Sound, Show FPS, Export Quality, and toy-specific controls: emitter heights (low/mid/high), particle count per emitter, gravity, wind strength, color palette selector. Use `extraHtml` parameter when calling `ui.createSettingsPanel(...)`.
   - Footer: reuse `ui.createZoomFooter` but repurpose callbacks to control global speed (onZoomIn/out map to speed up/slow down). Provide a zoom readout element `#zoom-readout` or `#speed-readout` in footer; ensure `createZoomFooter` is used so tests find footer.

5. **Developer TODOs & clear markers**
   - In `renderer.js` and `worker.js` add `// TODO: implement particle physics here` comments and minimal placeholder code so the toy runs without errors.
   - In `main.js` add `// TODO: wire real particle parameters and palette`.
   - In `ui-wiring.js` add `// TODO: implement toy-specific save/load serialization`.

6. **Startup self-test (dev only)**
   - After startup, run checks:
     - Exactly one header exists.
     - Exactly one footer exists.
     - Canvas exists and is absolutely positioned.
     - CSS vars `--header-height` and `--footer-height` are set.
     - Renderer `init` was called and `requestRender` is callable.
   - If any check fails, log console errors and call `ui.showToast(...)`. Expose results via `window.__TEST__`.

7. **Files content expectations**
   - Keep code short and readable (no heavy algorithms).
   - Use comments to explain where to implement real logic.
   - Use `async/await` where appropriate.
   - Use `addEventListener('DOMContentLoaded', ...)` in `main.js`.
   - Use `document.querySelector('.fixed.top-0')` and `.fixed.bottom-0` to compute header/footer heights as in `Architecture.md`.
   - Ensure `ui.createHeader('Particle Fountain')` is called before `updateCanvasLayout()`.

--- Deliverable (what I want you to output)
Produce a single multi-file scaffolding payload in plain text that I can paste into files in VS Code. For each file include a clear file header line like:

--- FILE: index.html
<file contents>

--- FILE: styles.css
<file contents>

...and so on for all files listed in section 3. Ensure each file is complete and ready to save. Keep each file under ~400 lines.

Do not implement full particle physics — placeholders and clear TODOs are fine. Focus on correct wiring to shared UI, adherence to CONTRACTS, and a working startup flow so the toy loads and shows a placeholder sky and three emitter markers.

At the end include a short checklist (3–6 items) the developer should run after pasting files (e.g., "open index.html in local server, verify header/footer, click Demo, click Save").