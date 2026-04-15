import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";

export default function AnnouncementsPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">Company-wide updates and news</p>
      </div>
      <AnnouncementsFeed />
    </div>
  );
}
