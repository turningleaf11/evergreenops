import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Plus, Save, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  reports_to: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface TeamNote {
  id: string;
  subject_user_id: string;
  author_id: string;
  type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  profiles: Profile[];
  departments: Department[];
  onProfileUpdated: () => void;
}

function PersonRow({ person, profiles, departments, onProfileUpdated }: {
  person: Profile;
  profiles: Profile[];
  departments: Department[];
  onProfileUpdated: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("one_on_one");
  const [form, setForm] = useState({
    title: person.title || "",
    department_id: person.department_id || "",
    reports_to: person.reports_to || "",
    bio: person.bio || "",
    phone: person.phone || "",
    email: person.email || "",
  });

  const initials = (person.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();
  const dept = departments.find((d) => d.id === person.department_id);

  useEffect(() => {
    if (!open) return;
    const fetchNotes = async () => {
      const { data } = await supabase
        .from("team_notes")
        .select("*")
        .eq("subject_user_id", person.user_id)
        .order("created_at", { ascending: false });
      if (data) setNotes(data);
    };
    fetchNotes();
  }, [open, person.user_id]);

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        title: form.title || null,
        department_id: form.department_id || null,
        reports_to: form.reports_to || null,
        bio: form.bio || null,
        phone: form.phone || null,
        email: form.email || null,
      })
      .eq("user_id", person.user_id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setEditing(false);
      onProfileUpdated();
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !user) return;
    const { error } = await supabase.from("team_notes").insert({
      subject_user_id: person.user_id,
      author_id: user.id,
      type: noteType,
      content: newNote.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewNote("");
      const { data } = await supabase
        .from("team_notes")
        .select("*")
        .eq("subject_user_id", person.user_id)
        .order("created_at", { ascending: false });
      if (data) setNotes(data);
    }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("team_notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 flex items-center gap-3">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{person.full_name || "Unnamed"}</p>
              <p className="text-xs text-muted-foreground truncate">{person.title || "No title"}</p>
            </div>
            {dept && <Badge variant="secondary" className="text-[10px] shrink-0">{dept.name}</Badge>}
          </CardContent>
        </Card>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-4 mt-2 mb-4 border-l-2 border-border pl-4 space-y-4">
          {/* Profile editing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile</h4>
              <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} className="h-7 text-xs">
                <Pencil className="h-3 w-3 mr-1" />
                {editing ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editing ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Title / Position</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Department</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-sm mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Reports To</Label>
                  <Select value={form.reports_to} onValueChange={(v) => setForm({ ...form, reports_to: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {profiles.filter((p) => p.user_id !== person.user_id).map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Bio</Label>
                  <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="text-sm mt-1" rows={2} />
                </div>
                <Button size="sm" onClick={saveProfile} className="w-fit h-7 text-xs">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Title:</span> {person.title || "—"}</p>
                <p><span className="text-muted-foreground">Email:</span> {person.email || "—"}</p>
                <p><span className="text-muted-foreground">Phone:</span> {person.phone || "—"}</p>
                <p><span className="text-muted-foreground">Reports to:</span> {profiles.find((p) => p.user_id === person.reports_to)?.full_name || "—"}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h4>

            <Tabs defaultValue="one_on_one" className="w-full">
              <TabsList className="h-7">
                <TabsTrigger value="one_on_one" className="text-[11px] px-2 h-6">1-on-1</TabsTrigger>
                <TabsTrigger value="growth" className="text-[11px] px-2 h-6">Growth</TabsTrigger>
                <TabsTrigger value="general" className="text-[11px] px-2 h-6">General</TabsTrigger>
              </TabsList>

              {["one_on_one", "growth", "general"].map((type) => (
                <TabsContent key={type} value={type} className="space-y-2 mt-2">
                  {notes.filter((n) => n.type === type).map((note) => (
                    <div key={note.id} className="bg-muted rounded-lg p-2.5 text-sm relative group">
                      <p className="pr-6 whitespace-pre-wrap">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder={`Add ${type.replace("_", " ")} note...`}
                      value={noteType === type ? newNote : ""}
                      onFocus={() => setNoteType(type)}
                      onChange={(e) => { setNoteType(type); setNewNote(e.target.value); }}
                      onKeyDown={(e) => e.key === "Enter" && noteType === type && addNote()}
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setNoteType(type); addNote(); }}
                      disabled={noteType !== type || !newNote.trim()}
                      className="h-7 w-7 p-0 shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TeamManagement({ profiles, departments, onProfileUpdated }: Props) {
  return (
    <div className="space-y-2">
      {profiles.map((person) => (
        <PersonRow
          key={person.user_id}
          person={person}
          profiles={profiles}
          departments={departments}
          onProfileUpdated={onProfileUpdated}
        />
      ))}
      {profiles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No team members found.</p>
      )}
    </div>
  );
}
