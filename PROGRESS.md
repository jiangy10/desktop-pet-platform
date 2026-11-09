# desktop-pet-platform · A generic desktop pet platform

> **Nature**: personal prototype, iterated from the original brian-desktop-pet project (which is only a reference; compatibility is not required). Requirements evolve as it is built.
> **Main purpose**: a generic desktop pet platform. A preset = assets + a complete state machine, and presets can be switched at any time. The state machine is edited by dragging nodes in the app instead of changing code.
> **Key trade-offs**:
> - The state machine moves from code into data (`preset.json`); the engine only interprets it
> - Two node kinds: simple nodes (one looping clip) and action nodes (`start` + `cycle × N` + `end`, N random)
> - Edges are weighted-random only for now; conditional triggers come later
> - Facing: one set of assets mirrored by default, with an optional per-clip asset for the other side
> - The editor uses React Flow; the pet window stays fully click-through, no click interaction in this version
> - Not doing: AI asset generation (separate session), cloud sync, multiple pets on screen, click interaction
> **Tech stack**: Electron + Vite + React + TypeScript; the engine is DOM-free pure TS (tested with Vitest)
> **Created**: 2026-11-08

**Progress**: 8 / 12
**Phase**: Phase 2 done; Phase 3 to be planned after hands-on use
**Last activity**: 2026-11-08

---

## Phase 1 · Engine and pet window  `[4/4]`

- [x] **DP0** (2026-11-08) Preset data format (`src/shared/types.ts`, with a `version` field)
- [x] **DP1** (2026-11-08) State machine engine + unit tests (including that a zero-duration loop does not spin forever)
- [x] **DP2** (2026-11-08) Transparent, always-on-top, click-through pet window, rAF-driven, mirrored rendering
- [x] **DP3** (2026-11-08) Sample preset import script (GIF durations parsed by block structure, matching the hand-written durations of the original project)

## Phase 2 · Editor and preset management  `[4/4]`

- [x] **DP4** (2026-11-08) Preset storage + IPC + `pet-asset://` protocol (userData/presets)
- [x] **DP5** (2026-11-08) React Flow node graph: drop nodes, connect, weights, delete
- [x] **DP6** (2026-11-08) Inspector: drop assets, auto-detected durations, loop range, facing rule, entry node
- [x] **DP7** (2026-11-08) Preset create/delete/switch + menu bar icon; the pet hot-reloads on save

## Phase 3 · Polish (to be planned after use)  `[0/4]`

- [ ] **DP8** Package as a `.app` + launch at login (launchd / login item)
- [ ] **DP9** Preset import/export (folder / zip sharing)
- [ ] **DP10** Editor: in-node preview playback, undo/redo, autosave
- [ ] **DP11** Conditional edges (time of day, idle time, etc.)

---

## Known limitations

- The sample preset's GIFs total about 60MB and are excluded by `.gitignore` (`resources/presets/*/assets/`). On a new machine regenerate them with `npm run make-sample -- <original repo's src/images>`, otherwise the first launch is a blank preset.
- The pet window only covers the bottom 400px of the primary display's work area.
- The editor's UI interactions (dropping assets, creating presets) were only checked at the data and rendering layers, not clicked through one by one.

## Log

<!-- LOG_START -->
2026-11-08  DP0-DP7  ✅  Skeleton fully working: engine tests pass, build passes, probing the real app showed the pet walking, mirroring and hot-reloading
2026-11-08  DP3  ✅  Pitfall: scanning GIF delays byte by byte can match bytes inside image data (computed 241s); the block structure must be walked properly
2026-11-08  fix  ✅  Flash when switching actions: the engine switched at the GIF's nominal duration while the new GIF needs 10–30ms to decode and appear, during which the old GIF looped back to frame 0 (start's frame 0 is the standing pose). Added preset.leadMs (default 60ms) so each phase ends early; decoding itself only takes 9–16ms, so it is not the bottleneck
2026-11-08  fix 2  ✅  Still flashing with only the early switch: measured a 1–2 frame (17–40ms) gap after changing a single <img>'s src, where the old picture is dropped and the new one is not on screen yet. Switched to a double buffer (two imgs; load + decode in the hidden one, then swap visibility); a 60s run showed 0 empty frames. leadMs stays as a margin for the old GIF looping back
<!-- LOG_END -->
