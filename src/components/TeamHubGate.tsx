// TeamHubGate — what a `team_hub`-role account sees if they land on OpsHQ.
//
// OpsHQ is still where every account gets created (Team Hub has no user
// management of its own), so this role exists to say "provisioned here,
// lives there": team_hub is the default for field members, and they should
// never see the cockpit. Previously nothing enforced that in the UI — only
// a handful of tables were RLS-blocked — so this closes that gap.
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut } from "lucide-react";
import { TEAM_HUB_URL } from "@/lib/teamHub";

export function TeamHubGate() {
  const { signOut } = useAuth();
  const workspace = useWorkspace();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center space-y-5 shadow-sm">
        {workspace.logoUrl ? (
          <img src={workspace.logoUrl} alt={workspace.name} className="h-12 w-12 rounded-lg object-cover mx-auto" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Your account lives in Team Hub</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            This is the ops workspace — your scripts, SOPs, training, and pace are all in the Team Hub app instead.
          </p>
        </div>
        <Button asChild className="w-full">
          <a href={TEAM_HUB_URL} target="_blank" rel="noreferrer">
            Open Team Hub <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
        <button
          onClick={() => signOut()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
        >
          <LogOut className="h-3 w-3" /> Sign out
        </button>
      </div>
    </div>
  );
}
