import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Plus, Star, Users, Lightbulb, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Kudo {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  category: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

const categories = [
  { value: "great_work", label: "Great Work", icon: Star, color: "text-amber-500" },
  { value: "team_player", label: "Team Player", icon: Users, color: "text-blue-500" },
  { value: "innovation", label: "Innovation", icon: Lightbulb, color: "text-purple-500" },
  { value: "leadership", label: "Leadership", icon: Trophy, color: "text-green-500" },
];

export function KudosWall() {
  const { user } = useAuth();
  const [kudos, setKudos] = useState<Kudo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("great_work");

  const fetchData = useCallback(async () => {
    const [kudosRes, profilesRes] = await Promise.all([
      supabase.from("kudos").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (kudosRes.data) setKudos(kudosRes.data as Kudo[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "Someone";

  const giveKudo = async () => {
    if (!user || !toUserId || !message.trim()) { toast.error("Select a person and add a message"); return; }
    const { error } = await supabase.from("kudos").insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      message: message.trim(),
      category,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Kudos sent! 🎉");
    setCreateOpen(false);
    setMessage("");
    setToUserId("");
    fetchData();
  };

  const getCategoryInfo = (cat: string) => categories.find(c => c.value === cat) || categories[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Heart className="h-4 w-4" /> Team Recognition
        </h2>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Give Kudos
        </Button>
      </div>

      {kudos.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No kudos yet — be the first to recognize a teammate!</CardContent></Card>
      ) : (
        kudos.map(k => {
          const catInfo = getCategoryInfo(k.category);
          const CatIcon = catInfo.icon;
          return (
            <Card key={k.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${catInfo.color}`}>
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{getName(k.from_user_id)}</span>
                      <span className="text-muted-foreground"> recognized </span>
                      <span className="font-medium">{getName(k.to_user_id)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{k.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{catInfo.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Give Kudos 🎉</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Who are you recognizing?</label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select teammate..." /></SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => p.user_id !== user?.id).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What did they do that was awesome?" className="mt-1 min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={giveKudo}>Send Kudos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
