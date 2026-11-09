import type { FacingRule, PetNode } from "../shared/types";
import { ClipField } from "./ClipField";

const FACING: { value: FacingRule; label: string }[] = [
  { value: "keep", label: "Keep facing" },
  { value: "flip", label: "Turn around on entry" },
  { value: "random", label: "Randomly turn around on entry" },
];

interface NodeProps {
  model: PetNode;
  presetId: string;
  isEntry: boolean;
  onChange: (m: PetNode) => void;
  onSetEntry: () => void;
}

const num = (v: string, fallback: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

export function NodeInspector({ model, presetId, isEntry, onChange, onSetEntry }: NodeProps) {
  return (
    <>
      <h3>{model.type === "simple" ? "Simple node" : "Action node"}</h3>
      <label>Name<input value={model.label} onChange={(e) => onChange({ ...model, label: e.target.value })} /></label>
      <label>Facing
        <select value={model.facing} onChange={(e) => onChange({ ...model, facing: e.target.value as FacingRule })}>
          {FACING.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </label>

      {model.type === "simple" ? (
        <>
          <ClipField presetId={presetId} label="Animation (looped)" clip={model.clip} onChange={(clip) => onChange({ ...model, clip })} />
          <div className="field-label">Dwell time (seconds)</div>
          <div className="row">
            <input type="number" min={0.1} step={0.5} value={model.dwellMs[0] / 1000}
              onChange={(e) => onChange({ ...model, dwellMs: [num(e.target.value, 1) * 1000, Math.max(model.dwellMs[1], num(e.target.value, 1) * 1000)] })} />
            <span>–</span>
            <input type="number" min={0.1} step={0.5} value={model.dwellMs[1] / 1000}
              onChange={(e) => onChange({ ...model, dwellMs: [Math.min(model.dwellMs[0], num(e.target.value, 1) * 1000), num(e.target.value, 1) * 1000] })} />
          </div>
          <label>Move speed (px/s along facing, 0 = stationary)
            <input type="number" value={model.speed} onChange={(e) => onChange({ ...model, speed: num(e.target.value, 0) })} />
          </label>
        </>
      ) : (
        <>
          <ClipField presetId={presetId} label="① Start" clip={model.start} onChange={(start) => onChange({ ...model, start })} />
          <ClipField presetId={presetId} label="② Cycle" clip={model.cycle} onChange={(cycle) => onChange({ ...model, cycle })} />
          <ClipField presetId={presetId} label="③ End" clip={model.end} onChange={(end) => onChange({ ...model, end })} />
          <div className="field-label">Cycle count (random range)</div>
          <div className="row">
            <input type="number" min={0} value={model.repeat[0]}
              onChange={(e) => onChange({ ...model, repeat: [num(e.target.value, 1), Math.max(model.repeat[1], num(e.target.value, 1))] })} />
            <span>–</span>
            <input type="number" min={0} value={model.repeat[1]}
              onChange={(e) => onChange({ ...model, repeat: [Math.min(model.repeat[0], num(e.target.value, 1)), num(e.target.value, 1)] })} />
          </div>
        </>
      )}

      <button disabled={isEntry} onClick={onSetEntry}>{isEntry ? "★ Current entry node" : "Set as entry node"}</button>
    </>
  );
}

export function EdgeInspector({ weight, onChange }: { weight: number; onChange: (w: number) => void }) {
  return (
    <>
      <h3>Edge</h3>
      <label>Weight (relative; larger = more likely to be chosen)
        <input type="number" min={0} step={1} value={weight} onChange={(e) => onChange(Math.max(0, num(e.target.value, 1)))} />
      </label>
      <p className="hint">Select it and press Backspace to delete. A weight of 0 disables the edge.</p>
    </>
  );
}
