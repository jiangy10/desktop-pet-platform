# desktop-pet-platform

A generic desktop pet platform. Every pet is a **preset** (assets + a state machine) that you can switch from the menu bar at any time. The state machine is edited by dragging nodes around in an editor, so no code changes are needed.

## What it does

1. **Desktop pet**: a transparent, always-on-top, click-through window. The pet walks around and performs actions by following the preset's state machine.
2. **Visual state machine**: node-graph editing with simple nodes (one looping clip) and action nodes (start + a random number of loops + end). Weighted edges decide where the pet goes next.
3. **Preset management**: create, delete and switch presets. Saving hot-reloads the pet immediately.
4. **Asset import**: drop GIF/PNG files onto the canvas or into a node slot. GIF durations are detected automatically, and if you only provide one facing the other is mirrored.

## Architecture

```
desktop-pet-platform/
├── electron/
│   ├── main.cjs        # main process: windows, tray icon, preset storage, IPC, pet-asset:// protocol
│   └── preload.cjs     # exposes window.petApi through contextBridge
├── src/
│   ├── shared/         # shared by the pet window and the editor
│   │   ├── types.ts    # Preset / Node / Edge / Clip data format
│   │   ├── engine.ts   # state machine interpreter (pure TS, no DOM, advanced by tick(dt))
│   │   ├── clip.ts     # picks the asset for a facing, mirroring the other side when one is missing
│   │   └── gif.ts      # parses GIF durations by walking the block structure
│   ├── pet/main.ts     # pet window: rAF drives the engine, double-buffered <img> swaps
│   └── editor/         # editor (React + React Flow)
├── scripts/make-sample.ts   # builds a sample preset from the original project's GIFs
├── resources/presets/       # built-in presets, copied to the user directory on first launch
├── pet.html / editor.html   # Vite multi-page entries
```

Presets live in `~/Library/Application Support/desktop-pet-platform/presets/<id>/{preset.json,assets/}`.

## Quickstart

```bash
npm install
npm run make-sample -- /path/to/original/brian-desktop-pet/src/images   # optional: build the sample preset
npm run dev        # Vite + Electron; also opens the editor
npm test           # engine unit tests
```

The 🐾 icon in the menu bar: open the editor / switch pet / quit.

The sample preset's GIFs come from the original `brian-desktop-pet` project (its `src/images`, last present at commit `1f20ce9` before this repository replaced it). They are large and not committed, so without them the first launch starts with a blank preset.

## Data flow

The editor's "Save & apply" calls `petApi.savePreset`, the main process writes `preset.json` and sends `pet:reload` to the pet window, and the pet window re-reads the preset, preloads its assets and creates a new engine.

## Switching animations without flicker

Swapping `src` on a single `<img>` drops the old picture before the new GIF is decoded, which shows up as a one-frame flash of the old GIF's frame 0. The pet window therefore uses two stacked `<img>` elements (a double buffer): the new asset is loaded and decoded in the hidden one, then visibility is swapped. In addition, each start/cycle/end phase ends `leadMs` (default 60 ms) before the GIF's nominal duration, which leaves a margin for the old GIF looping back to frame 0.
