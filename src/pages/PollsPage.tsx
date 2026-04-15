import { TeamPolls } from "@/components/TeamPolls";

export default function PollsPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team Polls</h1>
        <p className="text-sm text-muted-foreground">Quick surveys and team decisions</p>
      </div>
      <TeamPolls />
    </div>
  );
}
