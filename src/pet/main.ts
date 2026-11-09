import { PetEngine } from "../shared/engine";
import { resolveClip } from "../shared/clip";
import { assetUrl } from "../shared/assetUrl";
import type { Preset } from "../shared/types";

const imgs = [document.getElementById("petA"), document.getElementById("petB")] as HTMLImageElement[];
let raf = 0;
let generation = 0; // Invalidates async callbacks from the previous run when the preset reloads

function preload(preset: Preset) {
  const files = new Set<string>();
  for (const n of preset.nodes) {
    const clips = n.type === "simple" ? [n.clip] : [n.start, n.cycle, n.end];
    for (const c of clips) for (const f of [c?.left, c?.right]) if (f) files.add(f);
  }
  return Promise.all([...files].map((f) => new Promise<void>((res) => {
    const i = new Image();
    i.onload = i.onerror = () => res();
    i.src = assetUrl(preset.id, f);
  })));
}

async function start() {
  cancelAnimationFrame(raf);
  const gen = ++generation;
  const id = await window.petApi.getActive();
  const preset = id ? await window.petApi.loadPreset(id) : null;
  if (gen !== generation) return;
  for (const i of imgs) { i.style.visibility = "hidden"; i.removeAttribute("src"); }
  if (!preset) return;
  await preload(preset);
  if (gen !== generation) return;

  for (const i of imgs) i.style.height = `${preset.size}px`;
  const engine = new PetEngine(preset, [0, window.innerWidth]);

  let front = 0;       // index of the visible img
  let shownSrc = "";   // asset the visible img is playing
  let pendingSrc = ""; // asset being prepared in the hidden img
  let last = performance.now();

  /**
   * Double-buffered asset swap: set src on the hidden img, wait for its first frame to decode, then swap visibility synchronously.
   * The old picture stays up until the new one is ready, so there is no gap where the old image has been dropped and the new one is not on screen yet.
   */
  async function swapTo(src: string) {
    pendingSrc = src;
    const back = imgs[1 - front];
    back.src = src;
    try { await back.decode(); } catch { /* swap anyway if decoding fails, so the state machine never stalls */ }
    if (gen !== generation || pendingSrc !== src) return; // a newer request superseded this one
    back.style.visibility = "visible";
    imgs[front].style.visibility = "hidden";
    front = 1 - front;
    shownSrc = src;
  }

  const frame = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    const cur = imgs[front];
    engine.setBounds(0, window.innerWidth - cur.offsetWidth);
    engine.tick(dt);
    const v = engine.view;
    const r = v.clip ? resolveClip(v.clip, v.facing) : null;
    if (r) {
      const src = assetUrl(preset.id, r.file);
      if (src === shownSrc) pendingSrc = ""; // what we want is already playing; cancel the unfinished swap
      else if (src !== pendingSrc) void swapTo(src);
    }
    // Position and mirroring: set on both imgs so nothing jumps on swap
    const transform = `translateX(${v.x}px) scaleX(${r?.mirror ? -1 : 1})`;
    for (const i of imgs) i.style.transform = transform;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

window.petApi.onPresetChanged(start);
void start();
