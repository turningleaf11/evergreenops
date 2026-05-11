import { supabase } from '@/integrations/supabase/client';

export type ProcessBucket = {
  id: string;
  slug: string;
  name: string;
  bucket_order: number;
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

export const getProcessBuckets = async (): Promise<ProcessBucket[]> => {
  const { data, error } = await supabase
    .from('process_buckets')
    .select('*')
    .order('bucket_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const getProcessSteps = async (bucketId: string): Promise<ProcessStep[]> => {
  const { data, error } = await supabase
    .from('process_steps')
    .select('*')
    .eq('bucket_id', bucketId)
    .order('step_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const getBucketProjects = async (bucketId: string): Promise<BucketProject[]> => {
  const { data, error } = await supabase
    .from('bucket_projects')
    .select('*')
    .eq('bucket_id', bucketId);

  if (error) {
    throw error;
  }

  return data ?? [];
};
