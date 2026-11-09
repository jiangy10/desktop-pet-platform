import { describe, expect, it } from "vitest";
import { PetEngine } from "./engine";
import type { Preset } from "./types";

const clip = (ms: number) => ({ left: "a.gif", durationMs: ms });

const preset: Preset = {
  version: 1, id: "t", name: "t", size: 100, leadMs: 0, entry: "stand",
  nodes: [
    { id: "stand", type: "simple", label: "stand", position: { x: 0, y: 0 }, facing: "keep", clip: clip(100), dwellMs: [1000, 1000], speed: 0 },
    { id: "act", type: "action", label: "act", position: { x: 0, y: 0 }, facing: "keep", start: clip(500), cycle: clip(1000), end: clip(500), repeat: [2, 2] },
    { id: "walk", type: "simple", label: "walk", position: { x: 0, y: 0 }, facing: "keep", clip: clip(100), dwellMs: [10000, 10000], speed: 100 },
  ],
  edges: [{ id: "e1", from: "stand", to: "act", weight: 1 }, { id: "e2", from: "act", to: "walk", weight: 1 }],
};

const run = (e: PetEngine, ms: number, step = 10) => { for (let t = 0; t < ms; t += step) e.tick(step); };

describe("PetEngine", () => {
  it("a simple node dwells for its full duration, then follows the edge to the action node", () => {
    const e = new PetEngine(preset, [0, 1000], () => 0.5);
    run(e, 900);
    expect(e.view.nodeId).toBe("stand");
    run(e, 200);
    expect(e.view.nodeId).toBe("act");
    expect(e.view.phase).toBe("start");
  });

  it("an action node advances through start -> cycle×N -> end by their durations", () => {
    const e = new PetEngine(preset, [0, 1000], () => 0.5);
    run(e, 1010); // enter act
    run(e, 500); expect(e.view.phase).toBe("cycle");
    run(e, 2000); expect(e.view.phase).toBe("end");
    run(e, 500); expect(e.view.nodeId).toBe("walk");
  });

  it("turns around when it reaches the bounds", () => {
    const e = new PetEngine(preset, [0, 100], () => 0.5);
    e.setBounds(0, 100);
    run(e, 1010 + 500 + 2000 + 500 + 100);
    expect(e.view.nodeId).toBe("walk");
    run(e, 3000);
    expect(e.view.x).toBeGreaterThanOrEqual(0);
    expect(e.view.x).toBeLessThanOrEqual(100);
  });

  it("leadMs makes every phase end earlier than the GIF duration", () => {
    const e = new PetEngine({ ...preset, leadMs: 60 }, [0, 1000], () => 0.5);
    run(e, 1010); // enter act
    run(e, 500 - 60 + 20); // start only needs 440ms
    expect(e.view.phase).toBe("cycle");
  });

  it("returns to the entry node when there are no outgoing edges", () => {
    const p: Preset = { ...preset, edges: [] };
    const e = new PetEngine(p, [0, 100], () => 0.5);
    run(e, 1100);
    expect(e.view.nodeId).toBe("stand");
  });

  it("a loop of zero-duration nodes does not spin forever", () => {
    const z = { ...preset.nodes[1], start: null, cycle: null, end: null } as any;
    const p: Preset = { ...preset, entry: "act", nodes: [z], edges: [{ id: "s", from: "act", to: "act", weight: 1 }] };
    const e = new PetEngine(p, [0, 100], () => 0.5);
    expect(() => run(e, 500)).not.toThrow();
  });
});
