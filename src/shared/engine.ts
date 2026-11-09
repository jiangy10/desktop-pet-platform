import type { ActionNode, Clip, Facing, PetNode, Preset, SimpleNode } from "./types";

type Phase = "dwell" | "start" | "cycle" | "end";

export interface EngineView {
  nodeId: string;
  phase: Phase;
  clip: Clip | null;
  facing: Facing;
  x: number;
}

const MIN_PHASE_MS = 50;
export const DEFAULT_LEAD_MS = 60;

/**
 * State machine interpreter: depends only on preset data, never touches the DOM or timers; advanced by tick(dt).
 * An action node runs start -> cycle×N -> end, then follows a weighted random edge to the next node.
 */
export class PetEngine {
  x: number;
  facing: Facing = "left";
  private node!: PetNode;
  private phase: Phase = "dwell";
  private remaining = 0;
  private cyclesLeft = 0;
  private readonly leadMs: number;

  constructor(
    private preset: Preset,
    private bounds: [number, number],
    private rng: () => number = Math.random,
  ) {
    this.leadMs = preset.leadMs ?? DEFAULT_LEAD_MS;
    this.x = (bounds[0] + bounds[1]) / 2;
    this.enter(this.nodeById(preset.entry) ?? preset.nodes[0]);
  }

  setBounds(min: number, max: number) {
    this.bounds = [min, Math.max(min, max)];
    this.x = Math.min(Math.max(this.x, this.bounds[0]), this.bounds[1]);
  }

  get view(): EngineView {
    return { nodeId: this.node.id, phase: this.phase, clip: this.currentClip(), facing: this.facing, x: this.x };
  }

  tick(dtMs: number) {
    this.move(dtMs);
    this.remaining -= dtMs;
    // Carry the overshoot into the next phase to avoid accumulating drift; the guard stops zero-duration nodes from looping forever
    for (let guard = 0; this.remaining <= 0 && guard < 16; guard++) {
      const carry = this.remaining;
      this.advance();
      this.remaining += carry;
    }
  }

  private move(dtMs: number) {
    if (this.node.type !== "simple" || this.node.speed === 0) return;
    const dir = this.facing === "right" ? 1 : -1;
    this.x += (this.node.speed * dtMs * dir) / 1000;
    const [min, max] = this.bounds;
    if (this.x <= min) { this.x = min; this.facing = "right"; }
    if (this.x >= max) { this.x = max; this.facing = "left"; }
  }

  private currentClip(): Clip | null {
    const n = this.node;
    if (n.type === "simple") return n.clip;
    return this.phase === "start" ? n.start : this.phase === "end" ? n.end : n.cycle;
  }

  private nodeById(id: string) {
    return this.preset.nodes.find((n) => n.id === id);
  }

  private randBetween([lo, hi]: [number, number]) {
    return lo + this.rng() * Math.max(0, hi - lo);
  }

  private enter(node: PetNode) {
    this.node = node;
    if (node.facing === "flip") this.flip();
    else if (node.facing === "random" && this.rng() < 0.5) this.flip();
    if (node.type === "simple") {
      this.phase = "dwell";
      this.remaining = Math.max(MIN_PHASE_MS, this.randBetween((node as SimpleNode).dwellMs));
    } else {
      this.cyclesLeft = Math.round(this.randBetween((node as ActionNode).repeat));
      this.beginPhase("start");
    }
  }

  private flip() {
    this.facing = this.facing === "left" ? "right" : "left";
  }

  /** Begins a phase of an action node; phases with no clip or a count of 0 are skipped */
  private beginPhase(phase: "start" | "cycle" | "end") {
    const n = this.node as ActionNode;
    const clip = n[phase];
    const count = phase === "cycle" ? this.cyclesLeft : 1;
    this.phase = phase;
    if (!clip || count <= 0) {
      this.remaining = 0;
      return;
    }
    // End leadMs early to leave the next GIF time to decode and appear (see Preset.leadMs)
    this.remaining = Math.max(MIN_PHASE_MS, clip.durationMs * count - this.leadMs);
  }

  /** Current phase finished -> next phase / next node */
  private advance() {
    if (this.node.type === "simple") return this.goNext();
    if (this.phase === "start") return this.beginPhase("cycle");
    if (this.phase === "cycle") return this.beginPhase("end");
    this.goNext();
  }

  private goNext() {
    const out = this.preset.edges.filter((e) => e.from === this.node.id && e.weight > 0 && this.nodeById(e.to));
    const total = out.reduce((s, e) => s + e.weight, 0);
    let target: PetNode | undefined;
    if (total > 0) {
      let r = this.rng() * total;
      for (const e of out) {
        r -= e.weight;
        if (r < 0) { target = this.nodeById(e.to); break; }
      }
      target ??= this.nodeById(out[out.length - 1].to);
    }
    this.enter(target ?? this.nodeById(this.preset.entry) ?? this.preset.nodes[0]);
  }
}
