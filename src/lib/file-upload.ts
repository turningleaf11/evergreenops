import { supabase } from "@/integrations/supabase/client";

export async function uploadFile(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = file.name.split(".").pop() || "bin";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${user.id}/${uniqueId}.${ext}`;

  const { error } = await supabase.storage.from("files").upload(path, file);
  if (error) {
    console.error("Upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("files").getPublicUrl(path);
  return data.publicUrl;
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
