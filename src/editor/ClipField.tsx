import { useRef } from "react";
import { assetUrl } from "../shared/assetUrl";
import { gifDurationMs } from "../shared/gif";
import type { Clip } from "../shared/types";

interface Props {
  presetId: string;
  label: string;
  clip: Clip | null;
  onChange: (clip: Clip | null) => void;
}

export function ClipField({ presetId, label, clip, onChange }: Props) {
  async function pick(side: "left" | "right", file: File | undefined) {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = await window.petApi.importAsset(presetId, file.name, bytes);
    const dur = gifDurationMs(bytes);
    onChange({
      ...(clip ?? { durationMs: 1000 }),
      [side]: name,
      // Use the duration of a newly imported GIF if it can be parsed; keep the existing one if the new file is not a GIF
      durationMs: dur ?? clip?.durationMs ?? 1000,
    });
  }

  function clearSide(side: "left" | "right") {
    if (!clip) return;
    const next = { ...clip };
    delete next[side];
    onChange(next.left || next.right ? next : null);
  }

  return (
    <div className="field-group">
      <div className="field-label">{label}</div>
      <div className="clip-sides">
        <Slot presetId={presetId} title="Facing left" file={clip?.left} onPick={(f) => pick("left", f)} onClear={() => clearSide("left")} />
        <Slot presetId={presetId} title="Facing right (empty = mirror)" file={clip?.right} onPick={(f) => pick("right", f)} onClear={() => clearSide("right")} />
      </div>
      {clip && (
        <label className="inline">
          Duration (ms)
          <input type="number" min={50} value={clip.durationMs} onChange={(e) => onChange({ ...clip, durationMs: Number(e.target.value) })} />
        </label>
      )}
    </div>
  );
}

function Slot(p: { presetId: string; title: string; file?: string; onPick: (f: File | undefined) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className="slot"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); p.onPick(e.dataTransfer.files[0]); }}
      onClick={() => input.current?.click()}
    >
      {p.file ? <img src={assetUrl(p.presetId, p.file)} alt="" /> : <span>Drop or click</span>}
      <small>{p.title}</small>
      {p.file && <button className="x" onClick={(e) => { e.stopPropagation(); p.onClear(); }}>×</button>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { p.onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
