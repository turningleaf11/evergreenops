// Premium-feel design primitives. Import from here everywhere:
//   import { StatusPill, EntityCard, AvatarStack } from "@/components/primitives";
//
// Every entity surface (kanbans, lists, peeks) should consume these so
// statuses, priorities, avatars, and cards look identical across the app.

export { StatusPill } from "./StatusPill";
export type { StatusPillProps } from "./StatusPill";

export { PriorityPill } from "./PriorityPill";
export type { PriorityPillProps } from "./PriorityPill";

export { AvatarStack } from "./AvatarStack";
export type { AvatarStackPerson } from "./AvatarStack";

export { MetadataRow } from "./MetadataRow";
export type { MetadataItem } from "./MetadataRow";

export { EntityCard } from "./EntityCard";

export { EntityViewTabs } from "./EntityViewTabs";
export type { ViewType } from "./EntityViewTabs";

export { CoverImageZone } from "./CoverImageZone";
