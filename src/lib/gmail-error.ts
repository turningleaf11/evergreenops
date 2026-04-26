import { toast } from "sonner";

/**
 * Inspect an error returned from `supabase.functions.invoke('gmail-*', ...)` and,
 * if it's a "Gmail reauth required" error, surface a friendly toast with a
 * Reconnect action. Returns true if it was handled (caller should NOT show
 * its own toast).
 */
export async function handleGmailInvokeError(error: unknown): Promise<boolean> {
  if (!error) return false;
  let parsed: { error?: string; message?: string } | null = null;

  // supabase-js v2 FunctionsHttpError exposes the raw Response on `.context`
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.text === "function") {
    try {
      const text = await ctx.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    } catch {
      /* ignore */
    }
  }

  const code = parsed?.error ?? "";
  const msg = (parsed?.message ?? (error as { message?: string }).message ?? "").toLowerCase();
  const isReauth =
    code === "gmail_reauth_required" ||
    msg.includes("reconnect your gmail") ||
    msg.includes("token refresh failed") ||
    msg.includes("token has been expired") ||
    msg.includes("invalid_grant");

  if (isReauth) {
    toast.error("Gmail reconnect required", {
      description: "Your Gmail connection has expired. Reconnect to keep sending email.",
      action: {
        label: "Reconnect",
        onClick: () => {
          window.location.href = "/settings/integrations/gmail";
        },
      },
      duration: 10000,
    });
    return true;
  }

  return false;
}
