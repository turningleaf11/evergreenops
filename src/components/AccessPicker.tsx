import type { Visibility, SharedWith } from "@/lib/mock-data";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Building2, Lock } from "lucide-react";
import { useState, useEffect } from "react";

interface AccessPickerProps {
  visibility: Visibility;
  sharedWith: SharedWith;
  onChange: (visibility: Visibility, sharedWith: SharedWith) => void;
}

export default function AccessPicker({ visibility, sharedWith, onChange }: AccessPickerProps) {
  const { departments } = useDepartments();
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const options: { value: Visibility; label: string; desc: string; icon: React.ElementType }[] = [
    { value: "workspace", label: "Workspace", desc: "Everyone can access", icon: Globe },
    { value: "departments", label: "Departments", desc: "Selected departments only", icon: Building2 },
    { value: "private", label: "Private", desc: "Specific people only", icon: Lock },
  ];

  const toggleDept = (deptId: string) => {
    const ids = sharedWith.departmentIds.includes(deptId)
      ? sharedWith.departmentIds.filter((id) => id !== deptId)
      : [...sharedWith.departmentIds, deptId];
    onChange(visibility, { ...sharedWith, departmentIds: ids });
  };

  const toggleMember = (memberId: string) => {
    const ids = sharedWith.memberIds.includes(memberId)
      ? sharedWith.memberIds.filter((id) => id !== memberId)
      : [...sharedWith.memberIds, memberId];
    onChange(visibility, { ...sharedWith, memberIds: ids });
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium">Access</Label>
      <div className="flex gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = visibility === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value, sharedWith)} className={`flex-1 rounded-lg border p-2.5 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
              <Icon className={`h-4 w-4 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-xs font-medium">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {visibility === "departments" && (
        <div className="space-y-2 pt-1">
          <Label className="text-[11px] text-muted-foreground">Select departments</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {departments.map((dept) => (
              <label key={dept.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted transition-colors">
                <Checkbox checked={sharedWith.departmentIds.includes(dept.id)} onCheckedChange={() => toggleDept(dept.id)} />
                <span className="text-xs">{dept.name}</span>
              </label>
            ))}
          </div>
          {sharedWith.departmentIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sharedWith.departmentIds.map((id) => {
                const d = departments.find((dept) => dept.id === id);
                return d ? <Badge key={id} variant="secondary" className="text-[10px]">{d.name}</Badge> : null;
              })}
            </div>
          )}
        </div>
      )}

      {visibility === "private" && (
        <div className="space-y-2 pt-1">
          <Label className="text-[11px] text-muted-foreground">Select people</Label>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {profiles.map((member) => (
              <label key={member.user_id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-muted transition-colors">
                <Checkbox checked={sharedWith.memberIds.includes(member.user_id)} onCheckedChange={() => toggleMember(member.user_id)} />
                <span className="text-xs font-medium">{member.full_name || "Unnamed"}</span>
              </label>
            ))}
          </div>
          {sharedWith.memberIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sharedWith.memberIds.map((id) => {
                const m = profiles.find((p) => p.user_id === id);
                return m ? <Badge key={id} variant="secondary" className="text-[10px]">{m.full_name}</Badge> : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
