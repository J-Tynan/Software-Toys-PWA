# Particle Fountain (scaffold)

This folder contains a scaffolded Particle Fountain toy that follows the project's shared architecture and contracts.

Quick start (dev):
- Start static server from repo root: `npm run serve`
- Open: `http://localhost:8000/particle-fountain/index.html`

Files to implement:
- `renderer.js` / `worker.js` — implement real particle simulation and efficient rendering
- `visualizations.js` — helper draw routines for particles
- `ui-wiring.js` — extend toy settings UI via `createToySettingsPanel`

Testing:
- Add smoke tests to `tests/smoke` mirroring other toys (header exists, settings behavior, #canvas present)

TODO: add icons in `icons/` and update `manifest.json` with real images.
