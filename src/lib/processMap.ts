import { supabase } from '@/integrations/supabase/client';

export type ProcessBucket = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  position_x: number;
  position_y: number;
  bucket_order: number;
  parent_id: string | null;
  node_type: string;
};

export type ProcessStep = {
  id: string;
  bucket_id: string;
  title: string;
  description: string | null;
  step_order: number;
  is_complete: boolean;
};

export type BucketProject = {
  id: string;
  bucket_id: string;
  title: string;
  status: string;
  notes: string | null;
};

export type ProcessEdge = {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  edge_type: string;
};

export const ANNOTATION_TYPES = ['pain_point', 'idea', 'observation', 'improvement'] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export const ANNOTATION_LABELS: Record<AnnotationType, string> = {
  pain_point: 'Pain Point',
  idea: 'Idea',
  observation: 'Observation',
  improvement: 'Improvement',
};

export const ANNOTATION_COLORS: Record<AnnotationType, string> = {
  pain_point: 'bg-red-100 text-red-700',
  idea: 'bg-purple-100 text-purple-700',
  observation: 'bg-gray-100 text-gray-600',
  improvement: 'bg-blue-100 text-blue-700',
};

export type ProcessAnnotation = {
  id: string;
  bucket_id: string;
  annotation_type: AnnotationType;
  title: string;
  content: string | null;
  status: string;
  created_at: string;
};

// ── Buckets ────────────────────────────────────────────────

export const getProcessBuckets = async (parentId?: string | null): Promise<ProcessBucket[]> => {
  let q = supabase.from('process_buckets').select('*');
  if (parentId === null) q = q.is('parent_id', null);
  else if (parentId) q = q.eq('parent_id', parentId);
  const { data, error } = await q.order('bucket_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const createBucket = async (
  name: string,
  parentId: string | null,
  position: { x: number; y: number },
  siblings: number,
): Promise<ProcessBucket> => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { data, error } = await supabase
    .from('process_buckets')
    .insert({
      slug: `${slug}-${Date.now()}`,
      name,
      parent_id: parentId,
      position_x: position.x,
      position_y: position.y,
      bucket_order: siblings + 1,
      node_type: parentId ? 'process' : 'area',
      color: '#6366f1',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateBucket = async (id: string, fields: Partial<Pick<ProcessBucket, 'name' | 'description' | 'color'>>): Promise<void> => {
  const { error } = await supabase.from('process_buckets').update(fields).eq('id', id);
  if (error) throw error;
};

export const deleteBucket = async (id: string): Promise<void> => {
  const { error } = await supabase.from('process_buckets').delete().eq('id', id);
  if (error) throw error;
};

export const saveBucketPosition = async (id: string, x: number, y: number): Promise<void> => {
  const { error } = await supabase.from('process_buckets').update({ position_x: x, position_y: y }).eq('id', id);
  if (error) throw error;
};

// ── Edges ──────────────────────────────────────────────────

export const getProcessEdges = async (bucketIds: string[]): Promise<ProcessEdge[]> => {
  if (bucketIds.length === 0) return [];
  const { data, error } = await supabase
    .from('process_edges')
    .select('*')
    .in('source_id', bucketIds);
  if (error) throw error;
  return data ?? [];
};

export const createEdge = async (sourceId: string, targetId: string): Promise<ProcessEdge> => {
  const { data, error } = await supabase
    .from('process_edges')
    .insert({ source_id: sourceId, target_id: targetId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteEdge = async (sourceId: string, targetId: string): Promise<void> => {
  const { error } = await supabase
    .from('process_edges')
    .delete()
    .eq('source_id', sourceId)
    .eq('target_id', targetId);
  if (error) throw error;
};

// ── Annotations ────────────────────────────────────────────

export const getAnnotations = async (bucketId: string): Promise<ProcessAnnotation[]> => {
  const { data, error } = await supabase
    .from('process_annotations')
    .select('*')
    .eq('bucket_id', bucketId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProcessAnnotation[];
};

export const createAnnotation = async (
  bucketId: string,
  type: AnnotationType,
  title: string,
  content: string,
): Promise<ProcessAnnotation> => {
  const { data, error } = await supabase
    .from('process_annotations')
    .insert({ bucket_id: bucketId, annotation_type: type, title, content: content || null })
    .select()
    .single();
  if (error) throw error;
  return data as ProcessAnnotation;
};

export const deleteAnnotation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('process_annotations').delete().eq('id', id);
  if (error) throw error;
};

// ── Steps ──────────────────────────────────────────────────

export const getProcessSteps = async (bucketId: string): Promise<ProcessStep[]> => {
  const { data, error } = await supabase
    .from('process_steps')
    .select('*')
    .eq('bucket_id', bucketId)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const getBucketProjects = async (bucketId: string): Promise<BucketProject[]> => {
  const { data, error } = await supabase
    .from('bucket_projects')
    .select('*')
    .eq('bucket_id', bucketId);
  if (error) throw error;
  return data ?? [];
};
