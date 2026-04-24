import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Phone, Building2, User, Pencil, Camera, Plus, Trash2, Cake, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { OneOnOnesTab } from "@/components/people-ops/OneOnOnesTab";
import { GrowthTab } from "@/components/people-ops/GrowthTab";
import { OnboardingTab } from "@/components/people-ops/OnboardingTab";

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
  birthday?: string | null;
  start_date?: string | null;
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
}

interface Props {
  person: Profile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Department[];
  profiles: Profile[];
  onProfileUpdated?: () => void;
}

export function PersonDetail({ person, open, onOpenChange, departments, profiles, onProfileUpdated }: Props) {
  const { isAdmin, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("one_on_one");
  const [uploading, setUploading] = useState(false);

  const canEdit = isAdmin || user?.id === person?.user_id;

  useEffect(() => {
    if (person) {
      setForm({
        title: person.title,
        department_id: person.department_id,
        reports_to: person.reports_to,
        email: person.email,
        phone: person.phone,
        bio: person.bio,
        birthday: person.birthday ?? null,
        start_date: person.start_date ?? null,
      });
      setEditing(false);
    }
  }, [person]);

  const fetchNotes = useCallback(async () => {
    if (!person) return;
    const { data } = await supabase.from("team_notes").select("*").eq("subject_user_id", person.user_id).order("created_at", { ascending: false });
    if (data) setNotes(data);
  }, [person]);

  useEffect(() => { if (open && person) fetchNotes(); }, [open, person, fetchNotes]);

  if (!person) return null;

  const initials = (person.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();
  const dept = departments.find((d) => d.id === person.department_id);
  const manager = profiles.find((p) => p.user_id === person.reports_to);

  const handleSave = async () => {
    const { error } = await supabase.from("profiles").update({
      title: form.title || null,
      department_id: form.department_id || null,
      reports_to: form.reports_to || null,
      email: form.email || null,
      phone: form.phone || null,
      bio: form.bio || null,
      birthday: form.birthday || null,
      start_date: form.start_date || null,
    } as any).eq("user_id", person.user_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setEditing(false);
      onProfileUpdated?.();
    }
  };

  const handleAvatarUpload = () => {
    triggerFileInput("image/*", async (file) => {
      setUploading(true);
      const url = await uploadFile(file);
      if (url) {
        await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", person.user_id);
        toast({ title: "Photo updated" });
        onProfileUpdated?.();
      }
      setUploading(false);
    });
  };

  const addNote = async () => {
    if (!newNote.trim() || !user) return;
    const { error } = await supabase.from("team_notes").insert({
      subject_user_id: person.user_id,
      author_id: user.id,
      type: noteType,
      content: newNote.trim(),
    });
    if (!error) {
      setNewNote("");
      fetchNotes();
    }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("team_notes").delete().eq("id", id);
    fetchNotes();
  };

  const filteredNotes = (type: string) => notes.filter((n) => n.type === type);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto top-[60px] h-[calc(100vh-60px)] border-l border-border/50">
        <SheetHeader>
          <SheetTitle className="sr-only">Profile Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 pt-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                {person.avatar_url && <AvatarImage src={person.avatar_url} alt={person.full_name || ""} />}
                <AvatarFallback className="text-lg bg-muted">{initials}</AvatarFallback>
              </Avatar>
              {canEdit && (
                <button
                  onClick={handleAvatarUpload}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{person.full_name || "Unnamed"}</h2>
              {person.title && <p className="text-sm text-muted-foreground">{person.title}</p>}
              {dept && <Badge variant="secondary" className="mt-1 text-[11px]">{dept.name}</Badge>}
            </div>
            {canEdit && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* View mode */}
          {!editing && (
            <>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">About</h3>
                <p className="text-sm leading-relaxed">{person.bio || <span className="text-muted-foreground italic">No bio added yet</span>}</p>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</h3>
                <div className="flex items-center gap-2.5 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{person.title || <span className="text-muted-foreground italic">No title set</span>}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {person.email ? (
                    <a href={`mailto:${person.email}`} className="text-primary hover:underline">{person.email}</a>
                  ) : (
                    <span className="text-muted-foreground italic">No email on file</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{person.phone || <span className="text-muted-foreground italic">No phone on file</span>}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{dept ? dept.name : <span className="text-muted-foreground italic">No department</span>}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{manager ? <>Reports to <span className="font-medium">{manager.full_name || "Unnamed"}</span></> : <span className="text-muted-foreground italic">No manager assigned</span>}</span>
                </div>
                {person.birthday && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Cake className="h-4 w-4 text-pink-500" />
                    <span>Birthday <span className="font-medium">{format(parseISO(person.birthday), "MMMM d")}</span></span>
                  </div>
                )}
                {person.start_date && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <PartyPopper className="h-4 w-4 text-amber-500" />
                    <span>Joined <span className="font-medium">{format(parseISO(person.start_date), "MMM d, yyyy")}</span></span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Edit mode */}
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title / Position</label>
                <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Department</label>
                <Select value={form.department_id || ""} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reports to</label>
                <Select value={form.reports_to || ""} onValueChange={(v) => setForm({ ...form, reports_to: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {profiles.filter((p) => p.user_id !== person.user_id).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bio</label>
                <Textarea value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="text-sm mt-1" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Cake className="h-3 w-3" /> Birthday</label>
                  <Input type="date" value={form.birthday || ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><PartyPopper className="h-3 w-3" /> Start date</label>
                  <Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-8 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Admin notes section */}
          {isAdmin && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Team Notes</h3>
              <Tabs defaultValue="one_on_one">
                <TabsList className="h-8">
                  <TabsTrigger value="one_on_one" className="text-xs">1-on-1</TabsTrigger>
                  <TabsTrigger value="growth" className="text-xs">Growth</TabsTrigger>
                  <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                </TabsList>
                {["one_on_one", "growth", "general"].map((type) => (
                  <TabsContent key={type} value={type} className="space-y-3 mt-3">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder={`Add ${type.replace("_", " ")} note...`}
                        value={noteType === type ? newNote : ""}
                        onFocus={() => setNoteType(type)}
                        onChange={(e) => { setNoteType(type); setNewNote(e.target.value); }}
                        className="text-sm"
                        rows={2}
                      />
                      <Button size="icon" variant="outline" className="shrink-0 mt-auto" onClick={addNote} disabled={!newNote.trim() || noteType !== type}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {filteredNotes(type).map((note) => (
                      <div key={note.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 text-sm">
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap">{note.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.created_at).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {filteredNotes(type).length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
