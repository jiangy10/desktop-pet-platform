import { Handle, Position, type NodeProps } from "@xyflow/react";
import { assetUrl } from "../shared/assetUrl";
import type { Clip } from "../shared/types";
import type { FlowNode } from "./convert";

function Thumb({ presetId, clip, title }: { presetId: string; clip: Clip | null; title?: string }) {
  const file = clip?.left ?? clip?.right;
  return (
    <div className="thumb" title={title}>
      {file ? <img src={assetUrl(presetId, file)} alt="" draggable={false} /> : <span>None</span>}
    </div>
  );
}

const sec = (ms: number) => (ms / 1000).toFixed(1).replace(/\.0$/, "");

export function SimpleNodeView({ data, selected }: NodeProps<FlowNode>) {
  const m = data.model;
  if (m.type !== "simple") return null;
  return (
    <div className={`pet-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="pet-node-title">
        {data.isEntry && <b title="Entry node">★ </b>}
        {m.label}
      </div>
      <Thumb presetId={data.presetId} clip={m.clip} />
      <div className="pet-node-meta">
        Dwell {sec(m.dwellMs[0])}–{sec(m.dwellMs[1])}s{m.speed ? ` · ${m.speed}px/s` : ""}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function ActionNodeView({ data, selected }: NodeProps<FlowNode>) {
  const m = data.model;
  if (m.type !== "action") return null;
  return (
    <div className={`pet-node action ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="pet-node-title">
        {data.isEntry && <b title="Entry node">★ </b>}
        {m.label}
      </div>
      <div className="thumbs">
        <Thumb presetId={data.presetId} clip={m.start} title="Start" />
        <span>→</span>
        <Thumb presetId={data.presetId} clip={m.cycle} title="Cycle" />
        <span>→</span>
        <Thumb presetId={data.presetId} clip={m.end} title="End" />
      </div>
      <div className="pet-node-meta">1 + {m.repeat[0]}–{m.repeat[1]} cycles + 1</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
