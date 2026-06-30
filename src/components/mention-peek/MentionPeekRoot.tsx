import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMentionPeek } from "./MentionPeekProvider";
import PersonPeek from "./peeks/PersonPeek";
import DocPeek from "./peeks/DocPeek";
import TaskPeek from "./peeks/TaskPeek";
import RecordPeek from "./peeks/RecordPeek";
import GoalPeekWrapper from "./peeks/GoalPeekWrapper";
import IssuePeek from "./peeks/IssuePeek";

export function MentionPeekRoot() {
  const { active, closePeek } = useMentionPeek();
  const navigate = useNavigate();

  useEffect(() => {
    if (active?.type === "project") {
      navigate(`/projects/${active.id}`);
      closePeek();
    }
  }, [active]);

  if (!active || active.type === "project") return null;
  const { type, id } = active;

  switch (type) {
    case "person":  return <PersonPeek id={id} open onClose={closePeek} />;
    case "doc":     return <DocPeek id={id} open onClose={closePeek} variant="doc" />;
    case "note":    return <DocPeek id={id} open onClose={closePeek} variant="note" />;
    case "task":    return <TaskPeek id={id} open onClose={closePeek} />;
    case "goal":    return <GoalPeekWrapper id={id} open onClose={closePeek} />;
    case "record":  return <RecordPeek id={id} open onClose={closePeek} />;
    case "issue":   return <IssuePeek id={id} open onClose={closePeek} />;
    default:        return null;
  }
}
