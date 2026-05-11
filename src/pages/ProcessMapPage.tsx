import React, { useCallback, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Basic bucket nodes – positions are static for now
const initialNodes: Node[] = [
  {
    id: "leads",
    position: { x: 0, y: 0 },
    data: { label: "Leads" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
  {
    id: "followup",
    position: { x: 250, y: 0 },
    data: { label: "Follow Up" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
  {
    id: "offer",
    position: { x: 500, y: 0 },
    data: { label: "Offer" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
  {
    id: "escrow",
    position: { x: 750, y: 0 },
    data: { label: "Escrow" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
  {
    id: "dispo",
    position: { x: 1000, y: 0 },
    data: { label: "Dispo" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
  {
    id: "mngt",
    position: { x: 1250, y: 0 },
    data: { label: "Mngt" },
    style: { background: "#f5f5f5", border: "1px solid #ddd" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "leads", target: "followup", animated: true, type: "smoothstep" },
  { id: "e2", source: "followup", target: "offer", animated: true, type: "smoothstep" },
  { id: "e3", source: "offer", target: "escrow", animated: true, type: "smoothstep" },
  { id: "e4", source: "escrow", target: "dispo", animated: true, type: "smoothstep" },
  { id: "e5", source: "dispo", target: "mngt", animated: true, type: "smoothstep" },
];

export default function ProcessMapPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), []);

  // Simple side panel placeholder – in a full version we would show process details/project cards here
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main canvas */}
      <div className="flex-1 border-r border-gray-200">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="top-right"
        >
          <Background gap={15} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
      {/* Side panel */}
      <div className="w-80 p-4 overflow-y-auto">
        {selectedNode ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">{selectedNode.data?.label}</h3>
            <p className="text-sm text-gray-600">Current process steps and active projects will appear here.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a bucket to view details.</p>
        )}
      </div>
    </div>
  );
}
