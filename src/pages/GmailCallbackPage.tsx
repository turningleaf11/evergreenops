import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallbackState = "loading" | "success" | "error";

export default function GmailCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Connecting Gmail…");

  useEffect(() => {
    const statusParam = params.get("status");
    const emailParam = params.get("email");
    const messageParam = params.get("message");

    if (statusParam === "success") {
      setState("success");
      setMessage(emailParam ? `Connected as ${emailParam}` : "Gmail connected.");
      setTimeout(() => navigate("/settings/integrations/gmail"), 1500);
      return;
    }

    if (statusParam === "error") {
      setState("error");
      setMessage(messageParam || "Failed to complete Gmail connection");
      return;
    }

    const code = params.get("code");
    const stateParam = params.get("state");
    const errParam = params.get("error");

    if (errParam) {
      setState("error");
      setMessage(`Google returned: ${errParam}`);
      return;
    }

    if (!code || !stateParam) {
      setState("error");
      setMessage("Missing Gmail callback details");
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-callback", {
        body: { code, state: stateParam },
      });

      if (error || data?.error) {
        setState("error");
        setMessage(error?.message || data?.error || "Failed to complete connection");
        return;
      }

      setState("success");
      setMessage(`Connected as ${data.email}`);
      setTimeout(() => navigate("/settings/integrations/gmail"), 1500);
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {state === "loading" && <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />}
        {state === "success" && <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />}
        {state === "error" && <AlertCircle className="h-10 w-10 mx-auto text-destructive" />}
        <p className="text-sm">{message}</p>
        {state === "error" && (
          <Button onClick={() => navigate("/settings/integrations/gmail")} variant="outline" size="sm">
            Back to settings
          </Button>
        )}
      </div>
    </div>
  );
}
