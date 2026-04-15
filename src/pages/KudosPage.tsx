import { KudosWall } from "@/components/KudosWall";

export default function KudosPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team Recognition</h1>
        <p className="text-sm text-muted-foreground">Celebrate and recognize your teammates</p>
      </div>
      <KudosWall />
    </div>
  );
}
