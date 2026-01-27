# CONTRACTS

This document defines the public APIs, message schemas, startup checks, and error and shortcut contracts used across all software toys. Implementations must follow these contracts to ensure interoperability with the shared UI, automated smoke tests, and contributor expectations.



---



## Renderer public API

All renderer.js modules must export the following functions and behave as described.



### Functions

* **init({ ctx, uiTick, settleMs })** Initializes the renderer and worker.

  * ctx: CanvasRenderingContext2D
  * uiTick: function called each frame for UI FPS accounting
  * settleMs: number of milliseconds to treat as settle time for preview to full render

* **requestRender(opts)** Requests a render from the worker, opts must include:

  * minRe, maxRe, minIm, maxIm
  * width, height
  * maxIter
  * fractalType, juliaCr, juliaCi
  * paletteOffset
  * Optional preview boolean

* **setScale(s)** Sets the preview scale factor.
* **scheduleFullResRender(callback)** Schedules a full-quality render after preview settles.
* **terminate()** Terminates the worker and frees resources. Must be safe to call multiple times.
* **onError(cb)** Registers a callback for fatal or recoverable renderer or worker errors.



### Behavioral notes

* init must create or reuse a worker and attach message handlers.
* requestRender must support low-cost preview renders.
* scheduleFullResRender must guarantee a full-quality render after interaction settles.
* terminate must fail gracefully if called after shutdown.
* onError must be invoked for all fatal or recoverable errors.



---



### Worker message schema

Messages exchanged between the main thread and worker must be JSON-serializable objects with a type field and a payload object.

#### Main to worker

* { type: "render", payload: { ...render options... } }
* { type: "setParams", payload: { maxIter, paletteOffset } }
* { type: "terminate" }



#### Worker to main

* { type: "progress", payload: { percent } }
* { type: "result", payload: { imageBuffer } }
* { type: "error", payload: { message, code } }



#### Performance notes

* Use Transferable objects such as ArrayBuffer or ImageBitmap where possible.
* Progress messages should be throttled to avoid flooding the main thread.



---



### UI public API

shared/ui.js must export the following functions and also attach them to window.ui for legacy compatibility.



#### Functions

* **createHeader(title)** Creates and returns the fixed header element.
* **createZoomFooter({ onZoomIn, onZoomOut })** Creates and returns the fixed footer element.
* **createSettingsPanel(opts)** Creates the settings panel. opts may include fractal lists, current selection, callbacks, and extra HTML.
* **createInfoModal(html, title)** Creates an informational modal dialog.
* **showToast(message, type)** Displays a non-blocking toast message. type is one of: info, success, warning, error.
* **setFpsEnabled(enabled)** Enables or disables FPS display.
* **isFpsEnabled()** Returns whether FPS display is enabled.
* **tickFrame()** Called once per frame to update FPS counters.



#### UI expectations

* Exactly one header element must exist with predictable class names (for example div.fixed.top-0).
* Exactly one footer element must exist with predictable class names (for example div.fixed.bottom-0).
* Toasts must be usable during startup errors and must not block interaction.



---



### Startup self-test contract

In development builds, main.js must run a self-test that verifies:

* Exactly one header exists.
* The canvas element exists and is absolutely positioned.
* CSS variables --header-height and --footer-height are set.
* The renderer has been initialized and requestRender is callable.

If any check fails:

* Log a clear console error.
* Show a non-blocking toast describing the issue.
* Avoid uncaught exceptions that block the UI.

#### Required startup sequence
1. createHeader(title) and createZoomFooter(opts)
2. updateCanvasLayout() to compute header/footer heights
3. renderer.init({ ctx, uiTick, settleMs })
4. requestRender({ preview: false })
5. hide loading overlay and enable UI



### Error handling contract

* Worker and renderer errors must be posted using { type: "error", payload }.
* All registered onError callbacks must be invoked.
* Recoverable errors are shown as toasts.
* Fatal startup errors are shown as a modal with guidance and a link to the console.
* terminate() must be idempotent.

#### Suggested Error Codes
* INIT_ERROR — worker failed to start
* OOM — out of memory
* RENDER_ERROR — worker crashed during render
* INVALID_PARAMS — bad request payload


### Keyboard shortcuts registry

A centralized keyboard shortcut registry must exist in shared/ui.js or ui-wiring.js.

Example mapping:

* p: toggle pause
* +: zoom in
* -: zoom out
* r: reset view
* d: start demo mode



---



### Rules

* Shortcuts must be documented in the README.
* Per-toy wiring may override or extend shortcuts.
* Shortcuts must be ignored when focus is inside input or textarea elements.



### Versioning and compatibility

* Maintain a SHARED_API_VERSION constant in shared code.
* Per-toy code must check this version at startup and warn if incompatible.
* Bump the version for breaking changes and document them in this file.



### Testing hooks

Expose lightweight, development-only hooks for automated tests:

* window.__TEST__.getHeaderCount()
* window.__TEST__.getFooterCount()
* window.__TEST__.isRendererInitialized()
* window.__TEST__.getCanvasComputedStyle()

These hooks must be disabled or no-ops in production builds.



---



### Notes and best practices

* Use ES module named exports throughout shared and per-toy code.
* Provide window.\* fallbacks only for legacy compatibility.
* Enforce a single module entry per toy: index.html must load only main.js.
* Keep main.js focused on orchestration and startup checks; heavy logic belongs in renderer, worker, or visualization modules.
* Export limits and fallback - If requested export pixels > 8,000,000, show a dialog offering lower-quality options or allow the user to continue with a warning.
* Example error message: ```json { "type":"error", "payload": { "code":"INIT_ERROR", "message":"Worker failed to start", "fatal": true } }```
