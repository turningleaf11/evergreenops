import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Props {
  linkedDocs: any[];
}

export default function ProjectFilesTab({ linkedDocs }: Props) {
  const navigate = useNavigate();

  if (linkedDocs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No documents linked to this project yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {linkedDocs.map((doc) => (
        <button
          key={doc.id}
          onClick={() => navigate(`/docs/${doc.id}`)}
          className="text-left rounded-xl border border-border/50 bg-card/40 p-4 hover:bg-card/70 transition-colors"
        >
          <FileText className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-sm font-medium truncate">{doc.title}</p>
          {doc.updated_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(doc.updated_at), "MMM d, yyyy")}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
