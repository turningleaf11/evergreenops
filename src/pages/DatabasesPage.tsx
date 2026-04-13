import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { databases as initialDatabases, databaseRows as initialRows } from "@/lib/mock-data";
import type { Database, DatabaseRow, DatabaseColumn, Visibility, SharedWith } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Database as DbIcon, Target, FolderKanban, CheckSquare, Bug, Calendar, ArrowLeft, Trash2 } from "lucide-react";
import DatabaseView from "@/components/DatabaseView";
import DatabaseItemEditor from "@/components/DatabaseItemEditor";
import CreateDatabaseDialog from "@/components/CreateDatabaseDialog";
import { useAuth } from "@/contexts/AuthContext";

const iconMap: Record<string, React.ElementType> = {
  Target, FolderKanban, CheckSquare, Bug, Calendar, Plus,
};

export default function DatabasesPage() {
  const { dbId } = useParams<{ dbId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [allDatabases, setAllDatabases] = useState<Database[]>(initialDatabases);
  const [allRows, setAllRows] = useState<DatabaseRow[]>(initialRows);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DatabaseRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const currentDb = dbId ? allDatabases.find(d => d.id === dbId) : null;

  const handleCreateDatabase = (title: string, description: string, columns: DatabaseColumn[], icon: string, visibility: Visibility, sharedWith: SharedWith) => {
    const newDb: Database = {
      id: `db_${Date.now()}`,
      title,
      description,
      icon,
      visibility,
      sharedWith,
      createdBy: "Sarah Chen",
      columns,
    };
    setAllDatabases(prev => [...prev, newDb]);
    navigate(`/databases/${newDb.id}`);
  };

  const handleDeleteDatabase = (dbId: string) => {
    setAllDatabases(prev => prev.filter(d => d.id !== dbId));
    setAllRows(prev => prev.filter(r => r.databaseId !== dbId));
    navigate("/databases");
  };

  const handleAddRow = () => {
    setEditingRow(null);
    setIsNew(true);
    setEditorOpen(true);
  };

  const handleEditRow = (row: DatabaseRow) => {
    setEditingRow(row);
    setIsNew(false);
    setEditorOpen(true);
  };

  const handleSaveRow = (values: Record<string, any>) => {
    if (isNew && currentDb) {
      const newRow: DatabaseRow = {
        id: `r_${Date.now()}`,
        databaseId: currentDb.id,
        values,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      };
      setAllRows(prev => [...prev, newRow]);
    } else if (editingRow) {
      setAllRows(prev => prev.map(r => r.id === editingRow.id ? { ...r, values, updatedAt: new Date().toISOString().split("T")[0] } : r));
    }
    setEditorOpen(false);
  };

  const handleDeleteRow = () => {
    if (editingRow) {
      setAllRows(prev => prev.filter(r => r.id !== editingRow.id));
      setEditorOpen(false);
    }
  };

  // Database detail view
  if (currentDb) {
    const dbRows = allRows.filter(r => r.databaseId === currentDb.id);
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/databases")} className="h-8">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => handleDeleteDatabase(currentDb.id)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Database
            </Button>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentDb.title}</h1>
          <p className="text-muted-foreground mt-1">{currentDb.description}</p>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {currentDb.columns.map(col => (
              <span key={col.id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{col.name}</span>
            ))}
          </div>
        </div>

        <DatabaseView
          database={currentDb}
          rows={dbRows}
          onAdd={isAdmin ? handleAddRow : undefined}
          onEdit={isAdmin ? handleEditRow : undefined}
          onDelete={isAdmin ? (id) => setAllRows(prev => prev.filter(r => r.id !== id)) : undefined}
          allDatabases={allDatabases}
          allRows={allRows}
        />

        {currentDb && (
          <DatabaseItemEditor
            database={currentDb}
            row={editingRow}
            open={editorOpen}
            onClose={() => setEditorOpen(false)}
            onSave={handleSaveRow}
            onDelete={isAdmin && editingRow ? handleDeleteRow : undefined}
            allDatabases={allDatabases}
            allRows={allRows}
          />
        )}
      </div>
    );
  }

  // Database list view
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Databases</h1>
          <p className="text-muted-foreground mt-1">Create and manage your team's databases.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Database
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allDatabases.map(db => {
          const Icon = iconMap[db.icon] || DbIcon;
          const rowCount = allRows.filter(r => r.databaseId === db.id).length;
          return (
            <Link key={db.id} to={`/databases/${db.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
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