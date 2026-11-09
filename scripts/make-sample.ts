// Usage: npm run make-sample -- <path to the old repo's src/images>
// Imports the old GIFs (left-facing only; the right side is mirrored by the engine) as the sample preset resources/presets/brian-sample.
// The assets are large and excluded by .gitignore, so the sample preset's GIFs are not committed.
import fs from "node:fs";
import path from "node:path";
import { gifDurationMs } from "../src/shared/gif";
import type { Clip, ActionNode, Preset, SimpleNode } from "../src/shared/types";

const src = process.argv[2];
if (!src) throw new Error("Pass the old repo's src/images directory as an argument");
const out = path.join("resources", "presets", "brian-sample");
fs.mkdirSync(path.join(out, "assets"), { recursive: true });

function clip(dir: string, name: string): Clip {
  const file = `${name}_left.gif`;
  fs.copyFileSync(path.join(src, dir, file), path.join(out, "assets", file));
  const durationMs = gifDurationMs(fs.readFileSync(path.join(out, "assets", file))) ?? 1000;
  return { left: file, durationMs };
}

const simple = (id: string, label: string, x: number, y: number, dir: string, dwell: [number, number], speed: number): SimpleNode => ({
  id, type: "simple", label, position: { x, y }, facing: id === "move" ? "random" : "keep",
  clip: clip(dir, id === "move" ? "move" : "stand"), dwellMs: dwell, speed,
});

const action = (name: string, label: string, y: number, repeat: [number, number]): ActionNode => ({
  id: name, type: "action", label, position: { x: 560, y }, facing: "keep",
  start: clip(name, `${name}_start`), cycle: clip(name, `${name}_cycle`), end: clip(name, `${name}_end`), repeat,
});

const actions = [
  action("research", "Research", 0, [1, 3]),
  action("think", "Think", 160, [1, 3]),
  action("note", "Take notes", 320, [1, 3]),
  action("microscope", "Microscope", 480, [1, 3]),
];

const preset: Preset = {
  version: 1, id: "brian-sample", name: "Brian (sample)", size: 160, entry: "stand",
  nodes: [simple("stand", "Stand", 0, 200, "stand", [1000, 5000], 0), simple("move", "Walk", 280, 360, "move", [1800, 9000], 100), ...actions],
  edges: [
    { id: "s-m", from: "stand", to: "move", weight: 3 },
    { id: "m-s", from: "move", to: "stand", weight: 1 },
    ...actions.flatMap((a) => [
      { id: `s-${a.id}`, from: "stand", to: a.id, weight: 1 },
      { id: `${a.id}-s`, from: a.id, to: "stand", weight: 1 },
    ]),
  ],
};
fs.writeFileSync(path.join(out, "preset.json"), JSON.stringify(preset, null, 2));
console.log("done", out);
