import React, { useCallback, useEffect, useRef, useState } from "react";
import { VerticalGroupedLanding } from "@/components/process/VerticalGroupedLanding";
import { useAuth } from "@/contexts/AuthContext";
import {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertCircle,
  ArrowUpCircle,
  ChevronRight,
  Eye,
  FileText,
  Lightbulb,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  ANNOTATION_COLORS,
  ANNOTATION_LABELS,
  ANNOTATION_TYPES,
  AnnotationType,
  BucketProject,
  LinkedDoc,
  ProcessAnnotation,
  ProcessBucket,
  ProcessStep,
  ProcessVertical,
  createAnnotation,
  createBucket,
  createVertical,
  createEdge as createDbEdge,
  deleteAnnotation,
  deleteBucket,
  deleteEdge as deleteDbEdge,
  getAnnotations,
  getBucketProjects,
  getLinkedDocs,
  getProcessBuckets,
  getProcessEdges,
  getProcessSteps,
  getProcessVerticals,
  saveBucketPosition,
  updateBucket,
} from "@/lib/processMap";

// ── Icon map ────────────────────────────────────────────────────────────────

const ANNOTATION_ICONS: Record<AnnotationType, React.ElementType> = {
  pain_point: AlertCircle,
  idea: Lightbulb,
  observation: Eye,
  improvement: ArrowUpCircle,
};

// ── Node type badges ────────────────────────────────────────────────────────

const NODE_TYPE_STYLES: Record<string, string> = {
  area:    "bg-muted text-muted-foreground",
  source:  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  process: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  outcome: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  decision:"bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

// ── Custom canvas node ──────────────────────────────────────────────────────

type AreaNodeData = {
  bucket: ProcessBucket;
  onDelete: (id: string) => void;
  isSubprocess: boolean;
};

const AreaNode = React.memo(({ data, selected }: NodeProps) => {
  const { bucket, onDelete, isSubprocess } = data as AreaNodeData;
  const minW = isSubprocess ? 150 : 168;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: "hsl(var(--muted-foreground))" }} />
      <div
        className="group"
        style={{
          minWidth: minW,
          maxWidth: isSubprocess ? 200 : 230,
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          borderRadius: isSubprocess ? 8 : 10,
          border: `1.5px solid ${selected ? bucket.color : "hsl(var(--border))"}`,
          borderTop: `4px solid ${bucket.color}`,
          padding: isSubprocess ? "8px 12px" : "10px 14px",
          boxShadow: selected
            ? `0 0 0 3px ${bucket.color}33, 0 2px 8px rgba(0,0,0,0.25)`
            : "0 1px 4px rgba(0,0,0,0.2)",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isSubprocess && bucket.node_type !== "area" && (
              <span className={cn("inline-block mb-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide", NODE_TYPE_STYLES[bucket.node_type] ?? NODE_TYPE_STYLES.process)}>
                {bucket.node_type}
              </span>
            )}
            <p className={cn("font-semibold text-foreground leading-snug", isSubprocess ? "text-[12px]" : "text-sm")}>
              {bucket.name}
            </p>
          </div>
          <button
            className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground/60 hover:text-red-500"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(bucket.id); }}
            title="Delete node"
          >
            <X size={isSubprocess ? 11 : 13} />
          </button>
        </div>
        {bucket.description && (
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {bucket.description}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: "hsl(var(--muted-foreground))" }} />
    </>
  );
});
AreaNode.displayName = "AreaNode";

const NODE_TYPES = { areaNode: AreaNode };

// ── Converters ──────────────────────────────────────────────────────────────

const toFlowNode = (
  bucket: ProcessBucket,
  onDelete: (id: string) => void,
  isSubprocess: boolean,
): Node => ({
  id: bucket.id,
  position: { x: bucket.position_x, y: bucket.position_y },
  type: "areaNode",
  data: { bucket, onDelete, isSubprocess },
});

const toFlowEdge = (e: { id: string; source_id: string; target_id: string }): Edge => ({
  id: e.id,
  source: e.source_id,
  target: e.target_id,
  type: "smoothstep",
  style: { stroke: "#94a3b8", strokeWidth: 1.5 },
});

// ── Add Node dialog ─────────────────────────────────────────────────────────

function AddNodeDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, nodeType: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState("process");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onAdd(name.trim(), nodeType); setName(""); setNodeType("process"); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Add Process Node</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Node name"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(NODE_TYPE_STYLES).filter(([k]) => k !== "area").map(([k]) => (
                <button
                  key={k}
                  onClick={() => setNodeType(k)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all capitalize",
                    nodeType === k ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <Button size="sm" disabled={!name.trim() || saving} onClick={handleAdd}>
            {saving ? "Adding…" : "Add Node"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProcessMapPage() {
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id ?? undefined;

  // View mode: null = overview, ProcessBucket = subprocess of that area
  const [viewingArea, setViewingArea] = useState<ProcessBucket | null>(null);

  // Landing data
  const [verticals, setVerticals] = useState<ProcessVertical[]>([]);
  const [areas, setAreas] = useState<ProcessBucket[]>([]);

  // Canvas state (subprocess only)
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [canvasBuckets, setCanvasBuckets] = useState<ProcessBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sidebar state
  const [selected, setSelected] = useState<ProcessBucket | null>(null);
  const [annotations, setAnnotations] = useState<ProcessAnnotation[]>([]);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [projects, setProjects] = useState<BucketProject[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [nameChanged, setNameChanged] = useState(false);
  const [descChanged, setDescChanged] = useState(false);

  // Annotation form
  const [addingNote, setAddingNote] = useState(false);
  const [noteType, setNoteType] = useState<AnnotationType>("idea");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Add node dialog
  const [addNodeOpen, setAddNodeOpen] = useState(false);

  const deleteNodeRef = useRef<(id: string) => void>(() => {});
  const stableOnDelete = useCallback((id: string) => deleteNodeRef.current(id), []);

  // ── Load landing ───────────────────────────────────────────────────────────

  const loadLanding = useCallback(async () => {
    try {
      setIsLoading(true);
      const [verts, areaRows] = await Promise.all([
        getProcessVerticals(),
        getProcessBuckets(null),
      ]);
      setVerticals(verts);
      setAreas(areaRows);
    } catch (e) {
      toast({ title: "Failed to load", description: String(e), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Load subprocess canvas ─────────────────────────────────────────────────

  const loadCanvas = useCallback(async (parentId: string) => {
    try {
      setIsLoading(true);
      setSelected(null);
      const rows = await getProcessBuckets(parentId);
      const edgeRows = await getProcessEdges(rows.map((b) => b.id));
      setCanvasBuckets(rows);
      setNodes(rows.map((b) => toFlowNode(b, stableOnDelete, true)));
      setEdges(edgeRows.map(toFlowEdge));
    } catch (e) {
      toast({ title: "Failed to load canvas", description: String(e), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges, stableOnDelete]);

  useEffect(() => {
    if (viewingArea) {
      void loadCanvas(viewingArea.id);
    } else {
      void loadLanding();
    }
  }, [viewingArea, loadCanvas, loadLanding]);

  // ── Counts for landing cards ───────────────────────────────────────────────

  const bucketCounts = (() => {
    const out: Record<string, { children: number; steps: number; projects: number }> = {};
    for (const area of areas) {
      out[area.id] = { children: 0, steps: 0, projects: 0 };
    }
    return out;
  })();

  // ── Handlers: landing ──────────────────────────────────────────────────────

  const handleCreateVertical = useCallback(async (name: string, color: string) => {
    if (!workspaceId) return;
    try {
      const v = await createVertical(workspaceId, name, color);
      setVerticals((prev) => [...prev, v]);
      toast({ title: `"${v.name}" vertical created` });
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }, [workspaceId]);

  const handleCreateArea = useCallback(async (name: string, verticalId: string | null) => {
    if (!workspaceId) return;
    try {
      const area = await createBucket(
        workspaceId,
        name,
        null,
        { x: 0, y: 0 },
        areas.length,
        verticalId,
      );
      setAreas((prev) => [...prev, area]);
      toast({ title: `"${area.name}" area created` });
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }, [workspaceId, areas.length]);

  // ── Handlers: subprocess canvas ────────────────────────────────────────────

  const handleDeleteNode = useCallback(async (id: string) => {
    if (!confirm("Delete this node and all its annotations?")) return;
    try {
      await deleteBucket(id);
      setCanvasBuckets((prev) => prev.filter((b) => b.id !== id));
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Node deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: String(e), variant: "destructive" });
    }
  }, [selected, setNodes, setEdges]);

  deleteNodeRef.current = handleDeleteNode;

  const handleAddNode = useCallback(async (name: string, nodeType: string) => {
    if (!workspaceId || !viewingArea) return;
    const offsetX = 80 + canvasBuckets.length * 40;
    const offsetY = 80 + (canvasBuckets.length % 4) * 200;
    const bucket = await createBucket(workspaceId, name, viewingArea.id, { x: offsetX, y: offsetY }, canvasBuckets.length);
    // patch node_type if not default
    if (nodeType !== "process") {
      (bucket as any).node_type = nodeType;
    }
    setCanvasBuckets((prev) => [...prev, bucket]);
    setNodes((prev) => [...prev, toFlowNode(bucket, stableOnDelete, true)]);
    toast({ title: `"${bucket.name}" added` });
  }, [workspaceId, viewingArea, canvasBuckets.length, setNodes, stableOnDelete]);

  const handleConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    try {
      const saved = await createDbEdge(connection.source, connection.target);
      setEdges((prev) => addEdge(toFlowEdge(saved), prev));
    } catch {
      setEdges((prev) => addEdge({ id: `${connection.source}-${connection.target}`, source: connection.source!, target: connection.target!, type: "smoothstep", style: { stroke: "#94a3b8", strokeWidth: 1.5 } }, prev));
    }
  }, [setEdges]);

  const handleEdgesChange = useCallback(async (changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === "remove") {
        const edge = edges.find((e) => e.id === change.id);
        if (edge) { try { await deleteDbEdge(edge.source, edge.target); } catch { /* best effort */ } }
      }
    }
    onEdgesChange(changes);
  }, [edges, onEdgesChange]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    void saveBucketPosition(node.id, node.position.x, node.position.y);
  }, []);

  const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    const bucket = (node.data as AreaNodeData).bucket;
    setSelected(bucket);
    setEditName(bucket.name);
    setEditDesc(bucket.description ?? "");
    setNameChanged(false);
    setDescChanged(false);
    setAddingNote(false);
    setSidebarLoading(true);
    try {
      const [ann, stepRows, projRows, docs] = await Promise.all([
        getAnnotations(bucket.id),
        getProcessSteps(bucket.id),
        getBucketProjects(bucket.id),
        getLinkedDocs(bucket.slug),
      ]);
      setAnnotations(ann);
      setSteps(stepRows);
      setProjects(projRows);
      setLinkedDocs(docs);
    } catch { /* ignore */ }
    finally { setSidebarLoading(false); }
  }, []);

  const handleSaveName = useCallback(async () => {
    if (!selected || !nameChanged) return;
    try {
      await updateBucket(selected.id, { name: editName });
      setCanvasBuckets((prev) => prev.map((b) => b.id === selected.id ? { ...b, name: editName } : b));
      setNodes((prev) => prev.map((n) =>
        n.id === selected.id ? { ...n, data: { ...(n.data as object), bucket: { ...(n.data as AreaNodeData).bucket, name: editName } } } : n,
      ));
      setSelected((prev) => prev ? { ...prev, name: editName } : prev);
      setNameChanged(false);
    } catch (e) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    }
  }, [selected, editName, nameChanged, setNodes]);

  const handleSaveDesc = useCallback(async () => {
    if (!selected || !descChanged) return;
    try {
      await updateBucket(selected.id, { description: editDesc });
      setCanvasBuckets((prev) => prev.map((b) => b.id === selected.id ? { ...b, description: editDesc } : b));
      setNodes((prev) => prev.map((n) =>
        n.id === selected.id ? { ...n, data: { ...(n.data as object), bucket: { ...(n.data as AreaNodeData).bucket, description: editDesc } } } : n,
      ));
      setSelected((prev) => prev ? { ...prev, description: editDesc } : prev);
      setDescChanged(false);
    } catch (e) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    }
  }, [selected, editDesc, descChanged, setNodes]);

  const handleAddAnnotation = useCallback(async () => {
    if (!selected || !noteTitle.trim()) return;
    setSavingNote(true);
    try {
      const ann = await createAnnotation(selected.id, noteType, noteTitle.trim(), noteContent.trim());
      setAnnotations((prev) => [ann, ...prev]);
      setNoteTitle("");
      setNoteContent("");
      setAddingNote(false);
      toast({ title: "Note added" });
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    } finally { setSavingNote(false); }
  }, [selected, noteType, noteTitle, noteContent]);

  const handleDeleteAnnotation = useCallback(async (id: string) => {
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isSubprocess = viewingArea !== null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Toolbar / breadcrumb */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => setViewingArea(null)}
            className={cn("font-semibold hover:text-indigo-600 transition-colors", isSubprocess ? "text-muted-foreground" : "text-foreground")}
          >
            OS Map
          </button>
          {isSubprocess && (
            <>
              <ChevronRight size={14} className="text-muted-foreground/60" />
              <span className="font-semibold" style={{ color: viewingArea.color }}>{viewingArea.name}</span>
            </>
          )}
          {!isSubprocess && (
            <span className="text-muted-foreground/60 text-xs ml-1">— your business operating system</span>
          )}
        </div>
        {isSubprocess && (
          <Button size="sm" onClick={() => setAddNodeOpen(true)} className="gap-1.5 h-8">
            <Plus size={14} /> Add Node
          </Button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : !isSubprocess ? (
            <VerticalGroupedLanding
              verticals={verticals}
              areas={areas}
              bucketCounts={bucketCounts}
              onOpenArea={(b) => setViewingArea(b)}
              onCreateVertical={handleCreateVertical}
              onCreateArea={handleCreateArea}
            />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              deleteKeyCode="Delete"
              attributionPosition="bottom-left"
            >
              <Background gap={20} size={1} color="hsl(var(--border))" />
              <Controls />
              <MiniMap
                nodeColor={(n) => (n.data as AreaNodeData).bucket?.color ?? "#6366f1"}
                style={{ background: "hsl(var(--muted))" }}
                maskColor="hsl(var(--background) / 0.6)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Sidebar — subprocess only */}
        {isSubprocess && (
          <aside className="w-80 border-l border-border/40 bg-card flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Eye size={18} className="text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground">Select a step</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Click a process node to view details and notes</p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-y-auto">
                <div className="px-4 py-3 border-b border-border/40" style={{ borderTop: `3px solid ${selected.color}` }}>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-sm font-semibold border-transparent hover:border-border/40 focus:border-primary/40 px-1.5"
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    />
                    {nameChanged && (
                      <button onClick={handleSaveName} className="text-indigo-500 hover:text-indigo-700 shrink-0">
                        <Save size={13} />
                      </button>
                    )}
                  </div>
                  <Textarea
                    className="mt-1.5 text-xs text-muted-foreground border-transparent hover:border-border/40 focus:border-primary/40 resize-none min-h-0 px-1.5 py-1"
                    rows={2}
                    placeholder="Add a description..."
                    value={editDesc}
                    onChange={(e) => { setEditDesc(e.target.value); setDescChanged(true); }}
                    onBlur={handleSaveDesc}
                  />
                </div>

                {sidebarLoading ? (
                  <div className="p-4 text-xs text-muted-foreground/60">Loading...</div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {/* Annotations */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes & Ideas</h4>
                        <button
                          onClick={() => setAddingNote((v) => !v)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {addingNote ? "Cancel" : "+ Add"}
                        </button>
                      </div>

                      {addingNote && (
                        <div className="mb-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {ANNOTATION_TYPES.map((t) => {
                              const Icon = ANNOTATION_ICONS[t];
                              return (
                                <button
                                  key={t}
                                  onClick={() => setNoteType(t)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all",
                                    noteType === t ? ANNOTATION_COLORS[t] + " border-current" : "bg-card text-muted-foreground/60 border-border/40 hover:border-border",
                                  )}
                                >
                                  <Icon size={10} />
                                  {ANNOTATION_LABELS[t]}
                                </button>
                              );
                            })}
                          </div>
                          <Input
                            placeholder="Title *"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className="h-7 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && handleAddAnnotation()}
                          />
                          <Textarea
                            placeholder="Details (optional)"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            rows={2}
                            className="text-xs resize-none"
                          />
                          <Button
                            size="sm"
                            className="w-full h-7 text-xs"
                            disabled={!noteTitle.trim() || savingNote}
                            onClick={handleAddAnnotation}
                          >
                            {savingNote ? "Saving..." : "Save Note"}
                          </Button>
                        </div>
                      )}

                      {annotations.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">No notes yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {annotations.map((ann) => {
                            const Icon = ANNOTATION_ICONS[ann.annotation_type];
                            return (
                              <div key={ann.id} className="group rounded-lg border border-border/40 bg-background p-2.5 hover:border-border/40 transition-colors">
                                <div className="flex items-start gap-2">
                                  <span className={cn("mt-0.5 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", ANNOTATION_COLORS[ann.annotation_type])}>
                                    <Icon size={9} />{ANNOTATION_LABELS[ann.annotation_type]}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground leading-snug">{ann.title}</p>
                                    {ann.content && <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{ann.content}</p>}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteAnnotation(ann.id)}
                                    className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground/40 hover:text-red-400"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Linked Docs */}
                    {linkedDocs.length > 0 && (
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                          <FileText size={11} /> Linked Playbook Docs
                        </h4>
                        <div className="space-y-1.5">
                          {linkedDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2 text-xs text-foreground">
                              <span className="shrink-0">{doc.icon ?? "📄"}</span>
                              <span className="truncate">{doc.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Process Steps */}
                    {steps.length > 0 && (
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Process Steps</h4>
                        <div className="space-y-1.5">
                          {steps.map((step, i) => (
                            <div key={step.id} className="flex items-start gap-2 text-xs text-foreground">
                              <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="leading-snug">{step.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linked Projects */}
                    {projects.length > 0 && (
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Projects</h4>
                        <div className="space-y-1.5">
                          {projects.map((proj) => (
                            <div key={proj.id} className="flex items-center justify-between text-xs">
                              <span className="text-foreground truncate pr-2">{proj.title}</span>
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium">{proj.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <AddNodeDialog
        open={addNodeOpen}
        onClose={() => setAddNodeOpen(false)}
        onAdd={handleAddNode}
      />
    </div>
  );
}
