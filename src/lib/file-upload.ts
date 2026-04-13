import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "crypto";

export async function uploadFile(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${uuidv4()}.${ext}`;

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
