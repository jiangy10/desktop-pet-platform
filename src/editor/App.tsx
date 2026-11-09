import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow, type Connection,
} from "@xyflow/react";
import type { ActionNode, PetNode, Preset, PresetInfo, SimpleNode } from "../shared/types";
import { gifDurationMs } from "../shared/gif";
import { fromFlow, toFlow, toFlowEdge, type FlowEdge, type FlowNode } from "./convert";
import { ActionNodeView, SimpleNodeView } from "./nodes";
import { EdgeInspector, NodeInspector } from "./Inspector";

const nodeTypes = { simple: SimpleNodeView, action: ActionNodeView };
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function newModel(type: "simple" | "action", position: { x: number; y: number }): PetNode {
  const base = { id: uid("n"), position, facing: "keep" as const };
  if (type === "simple") {
    return { ...base, type, label: "New state", clip: null, dwellMs: [1000, 3000], speed: 0 } satisfies SimpleNode;
  }
  return { ...base, type, label: "New action", start: null, cycle: null, end: null, repeat: [1, 3] } satisfies ActionNode;
}

function Editor() {
  const [list, setList] = useState<PresetInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [base, setBase] = useState<Preset | null>(null);
  const [entry, setEntry] = useState("");
  const [dirty, setDirty] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const wrapper = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    setList(await window.petApi.listPresets());
    setActiveId(await window.petApi.getActive());
  }, []);

  const open = useCallback(async (id: string) => {
    const p = await window.petApi.loadPreset(id);
    if (!p) return;
    const f = toFlow(p);
    setBase(p); setEntry(p.entry); setNodes(f.nodes); setEdges(f.edges); setDirty(false);
  }, [setNodes, setEdges]);

  useEffect(() => {
    void (async () => {
      await refreshList();
      const id = await window.petApi.getActive();
      if (id) await open(id);
    })();
    return window.petApi.onPresetListChanged(() => void refreshList());
  }, [open, refreshList]);

  // When the entry node changes, sync every node's star
  useEffect(() => {
    setNodes((ns) => ns.map((n) => (n.data.isEntry === (n.id === entry) ? n : { ...n, data: { ...n.data, isEntry: n.id === entry } })));
  }, [entry, setNodes]);

  const guardDirty = () => !dirty || window.confirm("The current preset has unsaved changes. Discard them?");

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);
  const selectedEdge = useMemo(() => (selectedNode ? undefined : edges.find((e) => e.selected)), [edges, selectedNode]);

  const patchNode = (id: string, model: PetNode) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, model } } : n)));
    setDirty(true);
  };

  const onConnect = useCallback((c: Connection) => {
    setEdges((es) => addEdge(toFlowEdge({ id: uid("e"), from: c.source, to: c.target, weight: 1 }), es));
    setDirty(true);
  }, [setEdges]);

  const addNode = (model: PetNode) => {
    if (!base) return;
    setNodes((ns) => [...ns, { id: model.id, type: model.type, position: model.position, data: { model, isEntry: false, presetId: base.id } }]);
    setDirty(true);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!base) return;
    const position = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const kind = e.dataTransfer.getData("application/x-pet-node") as "simple" | "action" | "";
    if (kind) return addNode(newModel(kind, position));
    // Dropping an image file onto the canvas creates a simple node with that image
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = await window.petApi.importAsset(base.id, file.name, bytes);
      const m = newModel("simple", position) as SimpleNode;
      addNode({ ...m, label: file.name.replace(/\.[^.]+$/, ""), clip: { left: name, durationMs: gifDurationMs(bytes) ?? 1000 } });
    }
  };

  const save = async () => {
    if (!base) return;
    await window.petApi.savePreset(fromFlow(base, nodes, edges, entry));
    setDirty(false);
  };

  const create = async () => {
    const name = window.prompt("New preset name", "New preset");
    if (!name || !guardDirty()) return;
    const p = await window.petApi.createPreset(name);
    await refreshList();
    await open(p.id);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this preset and all its assets? This cannot be undone.")) return;
    await window.petApi.deletePreset(id);
    await refreshList();
    const next = (await window.petApi.listPresets())[0];
    if (next) await open(next.id);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Presets</h2>
        <ul className="presets">
          {list.map((p) => (
            <li key={p.id} className={p.id === base?.id ? "current" : ""}>
              <button className="link" onClick={() => guardDirty() && open(p.id)}>{p.name}</button>
              {p.id === activeId ? <span className="badge">In use</span> : <button className="mini" onClick={() => window.petApi.setActive(p.id).then(refreshList)}>Use</button>}
              <button className="mini danger" onClick={() => remove(p.id)}>Del</button>
            </li>
          ))}
        </ul>
        <button onClick={create}>+ New preset</button>

        <h2>Nodes (drag onto canvas)</h2>
        {(["simple", "action"] as const).map((k) => (
          <div key={k} className="palette" draggable onDragStart={(e) => e.dataTransfer.setData("application/x-pet-node", k)}>
            {k === "simple" ? "▢ Simple node" : "▣ Action node (start+cycle×N+end)"}
          </div>
        ))}
        <p className="hint">You can also drop a GIF/PNG onto the canvas to create a node with that asset. Drag from a node's right-hand dot to another node to connect them.</p>
      </aside>

      <main className="canvas" ref={wrapper} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <div className="topbar">
          {base && (
            <>
              <input className="name" value={base.name} onChange={(e) => { setBase({ ...base, name: e.target.value }); setDirty(true); }} />
              <label className="inline">Pet height (px)
                <input type="number" min={40} max={380} value={base.size} onChange={(e) => { setBase({ ...base, size: Number(e.target.value) }); setDirty(true); }} />
              </label>
              <label className="inline" title="How many ms each animation ends before the GIF's nominal duration. Increase it if you see a flash of the old animation when switching.">Switch lead (ms)
                <input type="number" min={0} max={300} value={base.leadMs ?? 60} onChange={(e) => { setBase({ ...base, leadMs: Number(e.target.value) }); setDirty(true); }} />
              </label>
              <button className="primary" disabled={!dirty} onClick={save}>{dirty ? "Save & apply" : "Saved"}</button>
            </>
          )}
        </div>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeDragStop={() => setDirty(true)} onNodesDelete={() => setDirty(true)} onEdgesDelete={() => setDirty(true)}
          onConnect={onConnect} deleteKeyCode={["Backspace", "Delete"]} fitView
        >
          <Background /><Controls /><MiniMap pannable zoomable />
        </ReactFlow>
      </main>

      <aside className="inspector">
        {selectedNode && base ? (
          <NodeInspector
            key={selectedNode.id} model={selectedNode.data.model} presetId={base.id}
            isEntry={selectedNode.id === entry}
            onChange={(m) => patchNode(selectedNode.id, m)}
            onSetEntry={() => { setEntry(selectedNode.id); setDirty(true); }}
          />
        ) : selectedEdge ? (
          <EdgeInspector
            key={selectedEdge.id} weight={selectedEdge.data?.weight ?? 1}
            onChange={(w) => { setEdges((es) => es.map((e) => (e.id === selectedEdge.id ? { ...e, label: String(w), data: { weight: w } } : e))); setDirty(true); }}
          />
        ) : (
          <p className="hint">Select a node or an edge to edit it.<br />The ★ marks the entry node (the pet starts there and returns there when a node has no outgoing edges).</p>
        )}
      </aside>
    </div>
  );
}

export function App() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>;
}
