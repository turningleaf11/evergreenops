import React, { useCallback, useEffect, useRef, useState } from "react";
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
  ProcessAnnotation,
  ProcessBucket,
  ProcessStep,
  createAnnotation,
  createBucket,
  createEdge as createDbEdge,
  deleteAnnotation,
  deleteBucket,
  deleteEdge as deleteDbEdge,
  getAnnotations,
  getBucketProjects,
  getProcessBuckets,
  getProcessEdges,
  getProcessSteps,
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
      <Handle type="target" position={Position.Left}  style={{ width: 8, height: 8, background: "hsl(var(--muted-foreground))" }} />
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProcessMapPage() {
  // View mode: null = overview, ProcessBucket = subprocess of that area
  const [viewingArea, setViewingArea] = useState<ProcessBucket | null>(null);

  // Canvas state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [buckets, setBuckets] = useState<ProcessBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sidebar state
  const [selected, setSelected] = useState<ProcessBucket | null>(null);
  const [annotations, setAnnotations] = useState<ProcessAnnotation[]>([]);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [projects, setProjects] = useState<BucketProject[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [nameChanged, setNameChanged] = useState(false);
  const [descChanged, setDescChanged] = useState(false);

  // Add annotation form
  const [addingNote, setAddingNote] = useState(false);
  const [noteType, setNoteType] = useState<AnnotationType>("idea");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Stable delete ref
  const deleteNodeRef = useRef<(id: string) => void>(() => {});
  const stableOnDelete = useCallback((id: string) => deleteNodeRef.current(id), []);

  // ── Load canvas ────────────────────────────────────────────────────────────

  const loadCanvas = useCallback(async (parentId: string | null) => {
    try {
      setIsLoading(true);
      setSelected(null);
      const rows = await getProcessBuckets(parentId);
      const ids = rows.map((b) => b.id);
      const edgeRows = await getProcessEdges(ids);
      setBuckets(rows);
      const isSubprocess = parentId !== null;
      setNodes(rows.map((b) => toFlowNode(b, stableOnDelete, isSubprocess)));
      setEdges(edgeRows.map(toFlowEdge));
    } catch (e) {
      toast({ title: "Failed to load map", description: String(e), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges, stableOnDelete]);

  useEffect(() => {
    void loadCanvas(viewingArea?.id ?? null);
  }, [viewingArea, loadCanvas]);

  // ── Node delete ────────────────────────────────────────────────────────────

  const handleDeleteNode = useCallback(async (id: string) => {
    if (!confirm("Delete this node and all its annotations?")) return;
    try {
      await deleteBucket(id);
      setBuckets((prev) => prev.filter((b) => b.id !== id));
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Node deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: String(e), variant: "destructive" });
    }
  }, [selected, setNodes, setEdges]);

  deleteNodeRef.current = handleDeleteNode;

  // ── Add node ────────────────────────────────────────────────────────────────

  const handleAddNode = useCallback(async () => {
    const name = prompt("Node name:");
    if (!name?.trim()) return;
    try {
      const offsetX = 80 + buckets.length * 40;
      const offsetY = 80 + (buckets.length % 4) * 200;
      const bucket = await createBucket(name.trim(), viewingArea?.id ?? null, { x: offsetX, y: offsetY }, buckets.length);
      setBuckets((prev) => [...prev, bucket]);
      setNodes((prev) => [...prev, toFlowNode(bucket, stableOnDelete, viewingArea !== null)]);
      toast({ title: `"${bucket.name}" added` });
    } catch (e) {
      toast({ title: "Failed to add node", description: String(e), variant: "destructive" });
    }
  }, [buckets, viewingArea, setNodes, stableOnDelete]);

  // ── Edge connect / delete ──────────────────────────────────────────────────

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

  // ── Position persistence ───────────────────────────────────────────────────

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    void saveBucketPosition(node.id, node.position.x, node.position.y);
  }, []);

  // ── Node select ────────────────────────────────────────────────────────────

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
      const [ann, stepRows, projRows] = await Promise.all([
        getAnnotations(bucket.id),
        getProcessSteps(bucket.id),
        getBucketProjects(bucket.id),
      ]);
      setAnnotations(ann);
      setSteps(stepRows);
      setProjects(projRows);
    } catch { /* ignore */ }
    finally { setSidebarLoading(false); }
  }, []);

  // ── Save name / desc ───────────────────────────────────────────────────────

  const handleSaveName = useCallback(async () => {
    if (!selected || !nameChanged) return;
    try {
      await updateBucket(selected.id, { name: editName });
      setBuckets((prev) => prev.map((b) => b.id === selected.id ? { ...b, name: editName } : b));
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
      setBuckets((prev) => prev.map((b) => b.id === selected.id ? { ...b, description: editDesc } : b));
      setNodes((prev) => prev.map((n) =>
        n.id === selected.id ? { ...n, data: { ...(n.data as object), bucket: { ...(n.data as AreaNodeData).bucket, description: editDesc } } } : n,
      ));
      setSelected((prev) => prev ? { ...prev, description: editDesc } : prev);
      setDescChanged(false);
    } catch (e) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    }
  }, [selected, editDesc, descChanged, setNodes]);

  // ── Annotations ────────────────────────────────────────────────────────────

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
            Process Map
          </button>
          {isSubprocess && (
            <>
              <ChevronRight size={14} className="text-muted-foreground/60" />
              <span className="font-semibold text-foreground" style={{ color: viewingArea.color }}>
                {viewingArea.name}
              </span>
            </>
          )}
          {!isSubprocess && (
            <span className="text-muted-foreground/60 text-xs ml-1">— drag nodes, connect with arrows, double-click to drill in</span>
          )}
        </div>
        <Button size="sm" onClick={handleAddNode} className="gap-1.5 h-8">
          <Plus size={14} />
          Add Node
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={(_e, node) => {
                if (!isSubprocess) {
                  const bucket = (node.data as AreaNodeData).bucket;
                  setViewingArea(bucket);
                }
              }}
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

        {/* Sidebar */}
        <aside className="w-80 border-l border-border/40 bg-card flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Eye size={18} className="text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {isSubprocess ? "Select a step" : "Select an area"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {isSubprocess
                  ? "Click a process step to view notes"
                  : "Click to select · Double-click to drill into subprocess"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Node header */}
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
                {/* Drill-in button for top-level area nodes */}
                {!isSubprocess && (
                  <button
                    onClick={() => setViewingArea(selected)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium border transition-colors hover:bg-background"
                    style={{ borderColor: selected.color, color: selected.color }}
                  >
                    View Subprocess <ChevronRight size={12} />
                  </button>
                )}
              </div>

              {sidebarLoading ? (
                <div className="p-4 text-xs text-muted-foreground/60">Loading...</div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Annotations */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes & Ideas
                      </h4>
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
                                  <Icon size={9} />
                                  {ANNOTATION_LABELS[ann.annotation_type]}
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
      </div>
    </div>
  );
}
