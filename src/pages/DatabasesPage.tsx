import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { DatabaseColumn, Visibility, SharedWith } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Database as DbIcon, Target, FolderKanban, CheckSquare, Bug, Calendar, ArrowLeft, Trash2, Save, Bookmark } from "lucide-react";
import DatabaseView from "@/components/DatabaseView";
import DatabaseRecordDetail from "@/components/DatabaseRecordDetail";
import CreateDatabaseDialog from "@/components/CreateDatabaseDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

interface DB {
  id: string;
  title: string;
  description: string;
  icon: string;
  visibility: Visibility;
  sharedWith: SharedWith;
  createdBy: string;
  columns: DatabaseColumn[];
}

interface DBRow {
  id: string;
  databaseId: string;
  values: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface SavedView {
  id: string;
  database_id: string;
  name: string;
  view_type: string;
  filters: any[];
  sorts: any[];
  group_by: string | null;
  column_order: string[];
  created_by: string | null;
}

const iconMap: Record<string, React.ElementType> = { Target, FolderKanban, CheckSquare, Bug, Calendar, Plus };

function mapDb(row: any): DB {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    icon: row.icon || "Database",
    visibility: row.visibility as Visibility,
    sharedWith: (row.shared_with as SharedWith) || { departmentIds: [], memberIds: [] },
    createdBy: row.created_by_name || "Unknown",
    columns: (row.columns as any as DatabaseColumn[]) || [],
  };
}

function mapRow(row: any): DBRow {
  return {
    id: row.id,
    databaseId: row.database_id,
    values: (row.values as Record<string, any>) || {},
    createdAt: row.created_at?.split("T")[0] || "",
    updatedAt: row.updated_at?.split("T")[0] || "",
  };
}

export default function DatabasesPage() {
  const { dbId } = useParams<{ dbId: string }>();
  const navigate = useNavigate();
  const { isAdmin, user, profile } = useAuth();
  const [allDatabases, setAllDatabases] = useState<DB[]>([]);
  const [allRows, setAllRows] = useState<DBRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DBRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [dbRes, rowRes, viewsRes] = await Promise.all([
        supabase.from("databases_meta").select("*").order("created_at"),
        supabase.from("database_rows").select("*"),
        supabase.from("database_views").select("*"),
      ]);
      if (dbRes.data) setAllDatabases(dbRes.data.map(mapDb));
      if (rowRes.data) setAllRows(rowRes.data.map(mapRow));
      if (viewsRes.data) setSavedViews(viewsRes.data as SavedView[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const currentDb = dbId ? allDatabases.find((d) => d.id === dbId) : null;

  const handleCreateDatabase = async (title: string, description: string, columns: DatabaseColumn[], icon: string, visibility: Visibility, sharedWith: SharedWith) => {
    const { data } = await supabase
      .from("databases_meta")
      .insert({
        title, description, columns: columns as any, icon, visibility,
        shared_with: sharedWith as any,
        created_by: user?.id || null,
        created_by_name: profile?.full_name || "Unknown",
      })
      .select().single();
    if (data) {
      setAllDatabases((prev) => [...prev, mapDb(data)]);
      navigate(`/databases/${data.id}`);
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    await supabase.from("database_rows").delete().eq("database_id", id);
    await supabase.from("databases_meta").delete().eq("id", id);
    setAllDatabases((prev) => prev.filter((d) => d.id !== id));
    setAllRows((prev) => prev.filter((r) => r.databaseId !== id));
    navigate("/databases");
  };

  const handleColumnsChange = async (columns: DatabaseColumn[]) => {
    if (!currentDb) return;
    await supabase.from("databases_meta").update({ columns: columns as any }).eq("id", currentDb.id);
    setAllDatabases(prev => prev.map(d => d.id === currentDb.id ? { ...d, columns } : d));
  };

  const handleAddRow = () => { setEditingRow(null); setIsNew(true); setDetailOpen(true); };
  const handleEditRow = (row: DBRow) => { setEditingRow(row as any); setIsNew(false); setDetailOpen(true); };

  const handleSaveRow = async (values: Record<string, any>) => {
    if (isNew && currentDb) {
      const { data } = await supabase
        .from("database_rows")
        .insert({ database_id: currentDb.id, values: values as any })
        .select().single();
      if (data) setAllRows((prev) => [...prev, mapRow(data)]);
    } else if (editingRow) {
      await supabase.from("database_rows").update({ values: values as any }).eq("id", editingRow.id);
      setAllRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, values } : r)));
    }
    setDetailOpen(false);
  };

  const handleDeleteRow = async () => {
    if (editingRow) {
      await supabase.from("database_rows").delete().eq("id", editingRow.id);
      setAllRows((prev) => prev.filter((r) => r.id !== editingRow.id));
      setDetailOpen(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading databases...</div>;

  if (currentDb) {
    const dbRows = allRows.filter((r) => r.databaseId === currentDb.id);
    const dbViews = savedViews.filter(v => v.database_id === currentDb.id);

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/databases")} className="h-8"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          {isAdmin && (<Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => handleDeleteDatabase(currentDb.id)}><Trash2 className="h-4 w-4 mr-1" /> Delete Database</Button>)}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentDb.title}</h1>
          {currentDb.description && <p className="text-muted-foreground mt-1">{currentDb.description}</p>}
        </div>

        {dbViews.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {dbViews.map(v => (
              <Badge key={v.id} variant="outline" className="text-[10px] cursor-pointer hover:bg-muted">
                <Bookmark className="h-2.5 w-2.5 mr-1" />{v.name}
              </Badge>
            ))}
          </div>
        )}

        <DatabaseView
          database={currentDb as any}
          rows={dbRows as any}
          onAdd={isAdmin ? handleAddRow : undefined}
          onEdit={handleEditRow as any}
          onDelete={isAdmin ? async (id) => { await supabase.from("database_rows").delete().eq("id", id); setAllRows((prev) => prev.filter((r) => r.id !== id)); } : undefined}
          onRowUpdate={async (rowId, values) => {
            await supabase.from("database_rows").update({ values: values as any }).eq("id", rowId);
            setAllRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, values } : r)));
          }}
          allDatabases={allDatabases as any}
          allRows={allRows as any}
          onColumnsChange={isAdmin ? handleColumnsChange : undefined}
          isAdmin={isAdmin}
        />

        <DatabaseRecordDetail
          database={currentDb as any}
          row={editingRow as any}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onSave={handleSaveRow}
          onDelete={isAdmin && editingRow ? handleDeleteRow : undefined}
          allDatabases={allDatabases as any}
          allRows={allRows as any}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Lists</h1><p className="text-muted-foreground mt-1">Create and manage your team's lists.</p></div>
        {isAdmin && (<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New List</Button>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allDatabases.map((db) => {
          const Icon = iconMap[db.icon] || DbIcon;
          const rowCount = allRows.filter((r) => r.databaseId === db.id).length;
          return (
            <Link key={db.id} to={`/databases/${db.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-foreground" /></div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{db.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{db.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{rowCount} rows</Badge>
                        <Badge variant="outline" className="text-[10px]">{db.columns.length} columns</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <CreateDatabaseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateDatabase} />
    </div>
  );
}
