import type { Clip, Facing } from "./types";

/** Picks the file to show for a facing; if that side is missing, uses the other side and flags it as mirrored */
export function resolveClip(clip: Clip, facing: Facing): { file: string; mirror: boolean } | null {
  const own = clip[facing];
  if (own) return { file: own, mirror: false };
  const other = clip[facing === "left" ? "right" : "left"];
  if (other) return { file: other, mirror: true };
  return null;
}
