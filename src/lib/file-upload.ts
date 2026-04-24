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
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/render/image/public/${bucket}/`,
    ];

    for (const marker of markers) {
      const start = parsed.pathname.indexOf(marker);
      if (start !== -1) {
        return decodeURIComponent(parsed.pathname.slice(start + marker.length));
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Open a stored file inside the in-app File Viewer (PDF/image preview, with
 * Download and Open-in-new-tab actions). Falls back to a new tab if the viewer
 * provider isn't mounted.
 */
export async function openStoredFile(url: string, options?: { fileName?: string; bucket?: string; mimeType?: string }) {
  const detail = { url, fileName: options?.fileName, mimeType: options?.mimeType };
  const dispatched = typeof window !== "undefined"
    && window.dispatchEvent(new CustomEvent("lovable:open-file", { detail, cancelable: true }));

  // If a listener (FileViewerProvider) handled it, we're done.
  if (dispatched && (window as any).__lovableFileViewerMounted) return;

  // Fallback: open in a new tab.
  window.open(url, "_blank", "noopener,noreferrer");
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
