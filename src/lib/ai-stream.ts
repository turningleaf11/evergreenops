import { toast } from "sonner";

export interface StreamChatArgs {
  url: string;
  body: any;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (call: { name: string; args: any }) => void;
  onDone?: () => void;
}

/**
 * Shared SSE streaming client for Lovable AI Gateway responses.
 * Handles text deltas + tool call accumulation.
 */
export async function streamChat({ url, body, onTextDelta, onToolCall, onDone }: StreamChatArgs) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
    if (resp.status === 429) toast.error("Rate limit exceeded. Please wait and try again.");
    else if (resp.status === 402) toast.error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(errorData.error || "Failed to get response");
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  // Accumulate tool calls by index
  const toolAcc: Record<number, { name: string; args: string }> = {};

  const handleDelta = (delta: any) => {
    if (delta?.content) onTextDelta?.(delta.content as string);
    if (Array.isArray(delta?.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolAcc[idx]) toolAcc[idx] = { name: "", args: "" };
        if (tc.function?.name) toolAcc[idx].name = tc.function.name;
        if (tc.function?.arguments) toolAcc[idx].args += tc.function.arguments;
      }
    }
  };

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        handleDelta(parsed.choices?.[0]?.delta);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        handleDelta(parsed.choices?.[0]?.delta);
      } catch { /* ignore */ }
    }
  }

  // Emit tool calls
  for (const idx of Object.keys(toolAcc)) {
    const tc = toolAcc[Number(idx)];
    if (!tc.name) continue;
    let parsedArgs: any = {};
    try { parsedArgs = JSON.parse(tc.args || "{}"); } catch { /* ignore */ }
    onToolCall?.({ name: tc.name, args: parsedArgs });
  }

  onDone?.();
}
