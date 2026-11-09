export type Facing = "left" | "right";
export type FacingRule = "keep" | "flip" | "random";

/** One animation. At least one of left/right is set; a missing side is mirrored from the other. */
export interface Clip {
  left?: string;
  right?: string;
  /** Duration of one playthrough (ms), summed from the GIF frame delays */
  durationMs: number;
}

interface BaseNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  /** How to handle facing when entering this node */
  facing: FacingRule;
}

/** Simple node: loops one animation for a random dwell time, optionally moving */
export interface SimpleNode extends BaseNode {
  type: "simple";
  clip: Clip | null;
  dwellMs: [number, number];
  /** px/s along the current facing; 0 means stationary */
  speed: number;
}

/** Action node: start + cycle × N + end, with N random within the repeat range */
export interface ActionNode extends BaseNode {
  type: "action";
  start: Clip | null;
  cycle: Clip | null;
  end: Clip | null;
  repeat: [number, number];
}

export type PetNode = SimpleNode | ActionNode;

export interface PetEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface Preset {
  version: 1;
  id: string;
  name: string;
  /** Pet display height (px) */
  size: number;
  /**
   * Switch lead (ms): every start/cycle/end phase ends this much earlier than the GIF's nominal duration.
   * A new GIF needs 10–30ms to decode and appear; switching late lets the old GIF loop back to frame 0 and flash. Default 60.
   */
  leadMs?: number;
  entry: string;
  nodes: PetNode[];
  edges: PetEdge[];
}

export interface PresetInfo {
  id: string;
  name: string;
}
