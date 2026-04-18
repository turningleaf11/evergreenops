import { supabase } from "@/integrations/supabase/client";

const FILES_BUCKET = "files";

export async function uploadFileWithPath(file: File): Promise<{ publicUrl: string; path: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = file.name.split(".").pop() || "bin";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${user.id}/${uniqueId}.${ext}`;

  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file);
  if (error) {
    console.error("Upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}

export async function uploadFile(file: File): Promise<string | null> {
  const uploaded = await uploadFileWithPath(file);
  return uploaded?.publicUrl ?? null;
}

export function getStoragePathFromUrl(url: string, bucket = FILES_BUCKET): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const start = parsed.pathname.indexOf(marker);

    if (start === -1) return null;

    return decodeURIComponent(parsed.pathname.slice(start + marker.length));
  } catch {
    return null;
  }
}

export async function openStoredFile(url: string, options?: { fileName?: string; bucket?: string }) {
  const bucket = options?.bucket ?? FILES_BUCKET;
  const path = getStoragePathFromUrl(url, bucket);

  if (!path) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;

  const blobUrl = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  const fileName = options?.fileName || path.split("/").pop() || "file";
  const canPreview = /^image\//i.test(data.type) || data.type === "application/pdf" || /\.(png|jpe?g|gif|webp|svg|bmp|pdf)$/i.test(fileName);

  anchor.href = blobUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  if (!canPreview) anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function triggerFileInput(accept: string, onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}
