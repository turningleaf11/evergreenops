import { AnnouncementCard } from "./AnnouncementCard";
import { PollCard } from "./PollCard";
import { KudosCard } from "./KudosCard";
import { PostCard } from "./PostCard";

export type FeedItem =
  | { type: "announcement"; data: any; created_at: string }
  | { type: "poll"; data: any; created_at: string }
  | { type: "kudos"; data: any; created_at: string }
  | { type: "post"; data: any; created_at: string };

export function FeedCard({ item, onRefresh }: { item: FeedItem; onRefresh?: () => void }) {
  switch (item.type) {
    case "announcement":
      return <AnnouncementCard announcement={item.data} />;
    case "poll":
      return <PollCard poll={item.data} />;
    case "kudos":
      return <KudosCard kudo={item.data} />;
    case "post":
      return <PostCard post={item.data} onRefresh={onRefresh} />;
    default:
      return null;
  }
}
