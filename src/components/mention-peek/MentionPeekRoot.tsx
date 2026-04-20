import { useMentionPeek } from "./MentionPeekProvider";
import PersonPeek from "./peeks/PersonPeek";
import DocPeek from "./peeks/DocPeek";
import TaskPeek from "./peeks/TaskPeek";
import ProjectPeek from "./peeks/ProjectPeek";
import RecordPeek from "./peeks/RecordPeek";
import GoalPeekWrapper from "./peeks/GoalPeekWrapper";

export function MentionPeekRoot() {
  const { active, closePeek } = useMentionPeek();
  if (!active) return null;
  const { type, id } = active;

  switch (type) {
    case "person":  return <PersonPeek id={id} open onClose={closePeek} />;
    case "doc":     return <DocPeek id={id} open onClose={closePeek} variant="doc" />;
    case "note":    return <DocPeek id={id} open onClose={closePeek} variant="note" />;
    case "task":    return <TaskPeek id={id} open onClose={closePeek} />;
    case "project": return <ProjectPeek id={id} open onClose={closePeek} />;
    case "goal":    return <GoalPeekWrapper id={id} open onClose={closePeek} />;
    case "record":  return <RecordPeek id={id} open onClose={closePeek} />;
    default:        return null;
  }
}
