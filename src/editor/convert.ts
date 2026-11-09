import type { Edge, Node } from "@xyflow/react";
import type { PetEdge, PetNode, Preset } from "../shared/types";

export interface NodeData extends Record<string, unknown> {
  model: PetNode;
  isEntry: boolean;
  presetId: string;
}
export interface EdgeData extends Record<string, unknown> {
  weight: number;
}
export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge<EdgeData>;

export function toFlow(preset: Preset): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: preset.nodes.map((m) => ({
      id: m.id,
      type: m.type,
      position: m.position,
      data: { model: m, isEntry: m.id === preset.entry, presetId: preset.id },
    })),
    edges: preset.edges.map(toFlowEdge),
  };
}

export function toFlowEdge(e: PetEdge): FlowEdge {
  return { id: e.id, source: e.from, target: e.to, label: String(e.weight), data: { weight: e.weight } };
}

export function fromFlow(base: Preset, nodes: FlowNode[], edges: FlowEdge[], entry: string): Preset {
  const petNodes: PetNode[] = nodes.map((n) => ({ ...n.data.model, id: n.id, position: n.position }));
  return {
    ...base,
    entry: petNodes.some((n) => n.id === entry) ? entry : (petNodes[0]?.id ?? ""),
    nodes: petNodes,
    edges: edges.map((e) => ({ id: e.id, from: e.source, to: e.target, weight: e.data?.weight ?? 1 })),
  };
}
