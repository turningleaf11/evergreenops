// StepDetailSheet — slide-out panel for a single process step.
// Contains: rich text description, sub-process ReactFlow canvas, linked docs, step issues.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background, Controls, Edge, Handle, Node, NodeProps, Position,
  ReactFlow, addEdge, useEdgesState, useNodesState, Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import RichTextEditor from "@/components/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import {
  ProcessBucket, LinkedDoc,
  createBucket, updateBucket, deleteBucket,
  getProcessBuckets, getProcessEdges,
  createEdge as createDbEdge, deleteEdge as deleteDbEdge,
  saveBucketPosition,
} from "@/lib/processMap";
import {
  X, Plus, Loader2, Link2, FileText, Lightbulb, AlertTriangle,
  Eye, ArrowUpCircle, Check, User, Layers, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

const sb = supabase as any;

// ── Types ──────────────────────────────────────────────────

const NODE_TYPE_OPTIONS = ["source", "process", "decision", "outcome"] as const;
type NodeType = typeof NODE_TYPE_OPTIONS[number];

const NODE_TYPE_STYLE: Record<NodeType, { label: string; cls: string }> = {
  source:   { label: "Source",   cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  process:  { label: "Process",  cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  decision: { label: "Decision", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  outcome:  { label: "Outcome",  cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
};

type ImprovementKind = "idea" | "pain_point" | "observation" | "improvement";
type ImprovementStatus = "open" | "in_review" | "converted" | "closed";

type Improvement = {
  id: string;
  bucket_id: string | null;
  step_id: string | null;
  title: string;
  kind: ImprovementKind;
  status: ImprovementStatus;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const KIND_ICON: Record<ImprovementKind, React.ElementType> = {
  idea: Lightbulb, pain_point: AlertTriangle, observation: Eye, improvement: ArrowUpCircle,
};
const KIND_CLS: Record<ImprovementKind, string> = {
  idea:        "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  pain_point:  "bg-red-500/10 text-red-700 dark:text-red-300",
  observation: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  improvement: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function toRichContent(text: string | null): string {
  if (!text) return "";
  if (text.trimStart().startsWith("<")) return text;
  return `<p>${text}</p>`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Sub-process canvas node ─────────────────────────────────

type SubNodeData = {
  bucket: ProcessBucket;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

function SubProcessNode({ data, selected }: NodeProps) {
  const { bucket, onDelete, onRename } = data as SubNodeData;
  const typeMeta = NODE_TYPE_STYLE[bucket.node_type as NodeType] ?? NODE_TYPE_STYLE.process;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bucket.name);

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ width: 7, height: 7, background: "hsl(var(--muted-foreground))" }} />
      <div
        className="group relative"
        style={{
          minWidth: 130, maxWidth: 180,
          background: "hsl(var(--card))",
          borderRadius: 8,
          border: `1.5px solid ${selected ? bucket.color : "hsl(var(--border))"}`,
          borderTop: `3px solid ${bucket.color}`,
          padding: "7px 10px",
          boxShadow: selected ? `0 0 0 2px ${bucket.color}33, 0 2px 6px rgba(0,0,0,0.2)` : "0 1px 3px rgba(0,0,0,0.15)",
          cursor: "default",
        }}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <span className={cn("inline-block mb-1 px-1 py-0 rounded text-[8px] font-bold uppercase tracking-wide", typeMeta.cls)}>
              {typeMeta.label}
            </span>
            {editing ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { setEditing(false); onRename(bucket.id, name); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onRename(bucket.id, name); } }}
                className="block w-full text-[11px] font-semibold bg-transparent outline-none border-b border-primary/40"
              />
            ) : (
              <p
                className="text-[11px] font-semibold text-foreground leading-snug cursor-text"
                onDoubleClick={() => setEditing(true)}
              >
                {bucket.name}
              </p>
            )}
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground/40 hover:text-red-400 transition-opacity mt-0.5"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(bucket.id); }}
          >
            <X size={9} />
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 7, height: 7, background: "hsl(var(--muted-foreground))" }} />
    </>
  );
}

SubProcessNode.displayName = "SubProcessNode";
const SUB_NODE_TYPES = { subNode: SubProcessNode };

// ── Mini canvas ─────────────────────────────────────────────

function SubProcessCanvas({ step, workspaceId }: { step: ProcessBucket; workspaceId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [addingNode, setAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<NodeType>("process");
  const subBucketsRef = useRef<ProcessBucket[]>([]);

  const toNode = useCallback((b: ProcessBucket, onDelete: (id: string) => void, onRename: (id: string, name: string) => void): Node => ({
    id: b.id,
    type: "subNode",
    position: { x: b.position_x, y: b.position_y },
    data: { bucket: b, onDelete, onRename },
  }), []);

  const handleDelete = useCallback((id: string) => {
    subBucketsRef.current = subBucketsRef.current.filter((b) => b.id !== id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    deleteBucket(id).catch((e) => toast.error(String(e)));
  }, [setNodes, setEdges]);

  const handleRename = useCallback((id: string, name: string) => {
    subBucketsRef.current = subBucketsRef.current.map((b) => b.id === id ? { ...b, name } : b);
    updateBucket(id, { name }).catch((e) => toast.error(String(e)));
    setNodes((prev) => prev.map((n) => n.id === id ? { ...n, data: { ...n.data, bucket: { ...(n.data as SubNodeData).bucket, name } } } : n));
  }, [setNodes]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const subBuckets = await getProcessBuckets(step.id);
      subBucketsRef.current = subBuckets;
      const subEdges = subBuckets.length > 0 ? await getProcessEdges(subBuckets.map((b) => b.id)) : [];
      setNodes(subBuckets.map((b) => toNode(b, handleDelete, handleRename)));
      setEdges(subEdges.map((e) => ({
        id: e.id, source: e.source_id, target: e.target_id,
        style: { strokeWidth: 1.5, stroke: "hsl(var(--muted-foreground))" },
      })));
      setLoading(false);
    };
    load();
  }, [step.id, toNode, handleDelete, handleRename, setNodes, setEdges]);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const edge = await createDbEdge(connection.source, connection.target);
    setEdges((prev) => addEdge({
      ...connection,
      id: edge.id,
      style: { strokeWidth: 1.5, stroke: "hsl(var(--muted-foreground))" },
    }, prev));
  }, [setEdges]);

  const onEdgeDelete = useCallback(async (edgesToDelete: Edge[]) => {
    for (const e of edgesToDelete) {
      await deleteDbEdge(e.source, e.target).catch(() => {});
    }
    setEdges((prev) => prev.filter((e) => !edgesToDelete.find((d) => d.id === e.id)));
  }, [setEdges]);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    saveBucketPosition(node.id, node.position.x, node.position.y).catch(() => {});
  }, []);

  const addNode = async () => {
    if (!newNodeName.trim()) return;
    const count = subBucketsRef.current.length;
    const bucket = await createBucket(
      workspaceId, newNodeName.trim(), step.id,
      { x: count * 200, y: 60 }, count, null, newNodeType,
    );
    subBucketsRef.current = [...subBucketsRef.current, bucket];
    setNodes((prev) => [...prev, toNode(bucket, handleDelete, handleRename)]);
    setNewNodeName(""); setAddingNode(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[280px] text-muted-foreground/40 text-xs gap-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading map…
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" /> Sub-Process Map
        </p>
        {!addingNode && (
          <button
            onClick={() => setAddingNode(true)}
            className="text-[10px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add node
          </button>
        )}
      </div>

      {addingNode && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex gap-1 shrink-0">
            {NODE_TYPE_OPTIONS.map((t) => (
              <button key={t} onClick={() => setNewNodeType(t)}
                className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize border transition-all",
                  newNodeType === t ? "border-primary bg-primary text-primary-foreground" : "border-border/40 text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>
          <input autoFocus value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNode(); if (e.key === "Escape") { setAddingNode(false); setNewNodeName(""); } }}
            placeholder="Node name…"
            className="flex-1 bg-transparent text-xs outline-none border-b border-border/40 focus:border-primary/40 transition-colors"
          />
          <button onClick={addNode} disabled={!newNodeName.trim()} className="text-[10px] text-primary disabled:opacity-40">Add</button>
          <button onClick={() => { setAddingNode(false); setNewNodeName(""); }} className="text-[10px] text-muted-foreground/40 hover:text-foreground">✕</button>
        </div>
      )}

      {nodes.length === 0 && !addingNode ? (
        <div
          onClick={() => setAddingNode(true)}
          className="flex flex-col items-center justify-center h-[220px] rounded-xl border-2 border-dashed border-border/40 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all text-center"
        >
          <GitBranch className="h-6 w-6 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground/40">Map out the sub-process for this step</p>
          <p className="text-[10px] text-muted-foreground/30 mt-1">Click to add a node</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden" style={{ height: 280 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgeDelete}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={SUB_NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.4}
            maxZoom={2}
            deleteKeyCode="Delete"
            className="bg-background/50"
          >
            <Background color="hsl(var(--border))" gap={20} size={0.8} />
            <Controls showInteractive={false} className="!bg-card !border-border/50 !shadow-sm" />
          </ReactFlow>
        </div>
      )}
      {nodes.length > 0 && (
        <p className="text-[10px] text-muted-foreground/30 text-right">
          Double-click a node to rename · drag handles to connect · Delete to remove
        </p>
      )}
    </div>
  );
}

// ── Main sheet ─────────────────────────────────────────────

interface StepDetailSheetProps {
  step: ProcessBucket | null;
  workspaceId: string;
  stepDocs: LinkedDoc[];
  onLinkStepDoc: (step: ProcessBucket, doc: { id: string; title: string; icon: string | null; tags: string[] }) => Promise<void>;
  onUnlinkStepDoc: (step: ProcessBucket, docId: string) => Promise<void>;
  profiles: Profile[];
  onOwnerChange: (stepId: string, ownerId: string | null) => void;
  onStepUpdate: (patch: Partial<ProcessBucket>) => void;
  improvements: Improvement[];
  onClose: () => void;
}

export function StepDetailSheet({
  step, workspaceId, stepDocs, onLinkStepDoc, onUnlinkStepDoc,
  profiles, onOwnerChange, onStepUpdate, improvements, onClose,
}: StepDetailSheetProps) {
  const [editName, setEditName]     = useState(step?.name ?? "");
  const [nameChanged, setNameChanged] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [docSearch, setDocSearch]   = useState("");
  const [docResults, setDocResults] = useState<{ id: string; title: string; icon: string | null; tags: string[] }[]>([]);
  const [docSearching, setDocSearching] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);
  const descSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setEditName(step?.name ?? "");
    setNameChanged(false);
  }, [step?.id]);

  if (!step) return null;

  const saveName = async () => {
    if (!nameChanged || !editName.trim()) return;
    await updateBucket(step.id, { name: editName.trim() });
    onStepUpdate({ name: editName.trim() });
    setNameChanged(false);
  };

  const handleDescChange = (html: string) => {
    clearTimeout(descSaveTimer.current);
    descSaveTimer.current = setTimeout(async () => {
      const plain = stripHtml(html);
      await updateBucket(step.id, { description: plain || null });
      onStepUpdate({ description: plain || null });
    }, 600);
  };

  const searchDocs = async (q: string) => {
    if (!q.trim()) { setDocResults([]); return; }
    setDocSearching(true);
    const { data } = await sb.from("documents").select("id, title, icon, tags").ilike("title", `%${q}%`).limit(6);
    setDocResults(data ?? []);
    setDocSearching(false);
  };

  const handleLinkDoc = async (doc: { id: string; title: string; icon: string | null; tags: string[] }) => {
    setLinkingDocId(doc.id);
    await onLinkStepDoc(step, doc);
    setDocSearch(""); setDocResults([]); setLinkingDocId(null);
  };

  const owner = profiles.find((p) => p.id === step.owner_id);
  const typeMeta = NODE_TYPE_STYLE[step.node_type as NodeType] ?? NODE_TYPE_STYLE.process;
  const stepIssues = improvements.filter((i) => i.step_id === step.id);
  const openIssues = stepIssues.filter((i) => i.status === "open" || i.status === "in_review");

  return (
    <Sheet open={!!step} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[680px] p-0 flex flex-col overflow-hidden"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="shrink-0 px-6 py-5 border-b border-border/40" style={{ borderLeft: `3px solid ${step.color}` }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Type badge row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="relative group/type">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide cursor-pointer", typeMeta.cls)}>
                    {typeMeta.label}
                  </span>
                  <div className="absolute top-full left-0 mt-1 z-20 hidden group-hover/type:flex flex-col bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {NODE_TYPE_OPTIONS.map((t) => (
                      <button key={t} onClick={async () => { await updateBucket(step.id, { node_type: t }); onStepUpdate({ node_type: t }); }}
                        className={cn("px-3 py-1.5 text-xs text-left hover:bg-muted/50 capitalize", step.node_type === t && "font-semibold text-primary")}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Owner chip */}
                <div className="relative">
                  {owner ? (
                    <button onClick={() => setShowOwnerPicker((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 hover:bg-muted text-[11px] text-muted-foreground transition-colors">
                      {owner.avatar_url
                        ? <img src={owner.avatar_url} className="w-3.5 h-3.5 rounded-full object-cover" />
                        : <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold">{initials(owner.full_name)}</span>
                      }
                      {owner.full_name ?? "Owner"}
                    </button>
                  ) : (
                    <button onClick={() => setShowOwnerPicker((v) => !v)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 transition-all">
                      <User className="h-3 w-3" /> Assign owner
                    </button>
                  )}
                  {showOwnerPicker && (
                    <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                      {profiles.map((p) => (
                        <button key={p.id} onClick={() => { onOwnerChange(step.id, p.id); setShowOwnerPicker(false); }}
                          className={cn("w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50", step.owner_id === p.id && "font-semibold text-primary")}>
                          {p.avatar_url
                            ? <img src={p.avatar_url} className="w-4 h-4 rounded-full object-cover shrink-0" />
                            : <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">{initials(p.full_name)}</span>
                          }
                          <span className="truncate">{p.full_name ?? p.id.slice(0, 8)}</span>
                        </button>
                      ))}
                      {step.owner_id && (
                        <button onClick={() => { onOwnerChange(step.id, null); setShowOwnerPicker(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground/50 hover:bg-muted/40 border-t border-border/40">
                          Remove owner
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {openIssues.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                    {openIssues.length} open {openIssues.length === 1 ? "issue" : "issues"}
                  </span>
                )}
              </div>

              {/* Step name */}
              <input
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="w-full text-xl font-bold text-foreground bg-transparent outline-none border-b-2 border-transparent hover:border-border/30 focus:border-primary/40 pb-0.5 transition-colors"
                placeholder="Step name"
              />
            </div>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Description — rich text */}
          <div className="px-6 pt-5 pb-2 border-b border-border/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Description</p>
            <div className="min-h-[80px]">
              <RichTextEditor
                key={step.id}
                content={toRichContent(step.description)}
                onChange={handleDescChange}
                placeholder="Describe what happens in this step, who's responsible, key decisions…"
                borderless
                compact
              />
            </div>
          </div>

          {/* Sub-process canvas */}
          <div className="px-6 py-5 border-b border-border/30">
            <SubProcessCanvas step={step} workspaceId={workspaceId} />
          </div>

          {/* Linked docs */}
          <div className="px-6 py-5 border-b border-border/30 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Docs
            </p>
            {stepDocs.map((doc) => (
              <div key={doc.id} className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-background/50 hover:border-border/70 transition-colors">
                <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
                <span className="flex-1 text-xs font-medium text-foreground truncate">{doc.title}</span>
                <button onClick={() => onUnlinkStepDoc(step, doc.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-opacity shrink-0">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30" />
              <input value={docSearch} onChange={(e) => { setDocSearch(e.target.value); searchDocs(e.target.value); }}
                placeholder="Link a doc…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border/40 bg-background outline-none focus:border-primary/40 transition-colors" />
              {docSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 animate-spin" />}
            </div>
            {docResults.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-background shadow-sm overflow-hidden divide-y divide-border/20">
                {docResults.map((doc) => {
                  const already = stepDocs.some((d) => d.id === doc.id);
                  return (
                    <button key={doc.id} onClick={() => !already && handleLinkDoc(doc)} disabled={linkingDocId === doc.id || already}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 disabled:opacity-60 transition-colors">
                      <span>{doc.icon ?? "📄"}</span>
                      <span className="flex-1 truncate">{doc.title}</span>
                      {already && <span className="text-[10px] text-emerald-600">linked</span>}
                      {linkingDocId === doc.id && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {stepDocs.length === 0 && !docSearch && (
              <p className="text-xs text-muted-foreground/30 italic">No docs linked yet</p>
            )}
          </div>

          {/* Issues tied to this step */}
          {stepIssues.length > 0 && (
            <div className="px-6 py-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Issues & Ideas
              </p>
              {stepIssues.map((imp) => {
                const Icon = KIND_ICON[imp.kind];
                const done = imp.status === "converted" || imp.status === "closed";
                return (
                  <div key={imp.id} className={cn("rounded-lg border border-border/40 bg-background/50 p-3 flex items-start gap-2", done && "opacity-40")}>
                    <span className={cn("inline-flex items-center p-1 rounded-full shrink-0 mt-0.5", KIND_CLS[imp.kind])}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <p className={cn("text-xs text-foreground leading-relaxed", done && "line-through")}>{imp.title}</p>
                    {done && <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-auto">{imp.status}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
