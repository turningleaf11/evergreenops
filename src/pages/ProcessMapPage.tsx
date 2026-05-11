import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  BucketProject,
  getBucketProjects,
  getProcessBuckets,
  getProcessSteps,
  ProcessBucket,
  ProcessStep,
} from "@/lib/processMap";

const bucketToNode = (bucket: ProcessBucket, index: number): Node => ({
  id: bucket.id,
  position: { x: index * 250, y: 0 },
  data: { label: bucket.name, bucket },
  style: {
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
});

const bucketsToEdges = (buckets: ProcessBucket[]): Edge[] =>
  buckets.slice(0, -1).map((bucket, index) => ({
    id: `edge-${bucket.id}-${buckets[index + 1].id}`,
    source: bucket.id,
    target: buckets[index + 1].id,
    animated: true,
    type: "smoothstep",
  }));

export default function ProcessMapPage() {
  const [buckets, setBuckets] = useState<ProcessBucket[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedBucket, setSelectedBucket] = useState<ProcessBucket | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [projects, setProjects] = useState<BucketProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBuckets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const bucketRows = await getProcessBuckets();

        if (!isMounted) return;

        setBuckets(bucketRows);
        setNodes(bucketRows.map(bucketToNode));
        setEdges(bucketsToEdges(bucketRows));
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load process buckets.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadBuckets();

    return () => {
      isMounted = false;
    };
  }, [setEdges, setNodes]);

  useEffect(() => {
    let isMounted = true;

    const loadPanelData = async () => {
      if (!selectedBucket) {
        setSteps([]);
        setProjects([]);
        return;
      }

      try {
        setIsPanelLoading(true);
        const [stepRows, projectRows] = await Promise.all([
          getProcessSteps(selectedBucket.id),
          getBucketProjects(selectedBucket.id),
        ]);

        if (!isMounted) return;

        setSteps(stepRows);
        setProjects(projectRows);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load bucket details.");
      } finally {
        if (isMounted) {
          setIsPanelLoading(false);
        }
      }
    };

    loadPanelData();

    return () => {
      isMounted = false;
    };
  }, [selectedBucket]);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const bucket = node.data?.bucket as ProcessBucket | undefined;
    setSelectedBucket(bucket ?? null);
  }, []);

  const selectedBucketName = useMemo(() => selectedBucket?.name ?? "No bucket selected", [selectedBucket]);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 border-r border-gray-200 relative">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading process map...</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">{error}</div>
        ) : buckets.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">No process buckets found.</div>
        ) : (
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
        )}
      </div>

      <aside className="w-96 p-5 overflow-y-auto bg-white">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Selected Bucket</p>
          <h3 className="text-xl font-semibold text-gray-900">{selectedBucketName}</h3>
        </div>

        {!selectedBucket ? (
          <p className="text-sm text-gray-500">Select a bucket to view process steps and active projects.</p>
        ) : isPanelLoading ? (
          <p className="text-sm text-gray-500">Loading bucket details...</p>
        ) : (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Process Steps</h4>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">{steps.length}</span>
              </div>

              {steps.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500">
                  No steps yet for this bucket.
                </p>
              ) : (
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div key={step.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{step.title}</p>
                          {step.description ? <p className="mt-1 text-xs text-gray-500">{step.description}</p> : null}
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          {step.is_complete ? "Done" : "Open"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Active Projects</h4>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">{projects.length}</span>
              </div>

              {projects.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500">
                  No projects assigned to this bucket yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div key={project.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{project.title}</p>
                          {project.notes ? <p className="mt-1 text-xs text-gray-500">{project.notes}</p> : null}
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                          {project.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
