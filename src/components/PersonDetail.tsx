import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2, User, Briefcase } from "lucide-react";

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

interface Props {
  person: Profile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Department[];
  profiles: Profile[];
}

export function PersonDetail({ person, open, onOpenChange, departments, profiles }: Props) {
  if (!person) return null;

  const dept = departments.find((d) => d.id === person.department_id);
  const manager = profiles.find((p) => p.user_id === person.reports_to);
  const initials = (person.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="sr-only">Profile Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{person.full_name || "Unnamed"}</h2>
              {person.title && <p className="text-sm text-muted-foreground">{person.title}</p>}
            </div>
          </div>

          {person.bio && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">About</h3>
              <p className="text-sm leading-relaxed">{person.bio}</p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</h3>

            {dept && (
              <div className="flex items-center gap-2.5 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{dept.name}</span>
              </div>
            )}

            {person.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${person.email}`} className="text-primary hover:underline">{person.email}</a>
              </div>
            )}

            {person.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{person.phone}</span>
              </div>
            )}

            {manager && (
              <div className="flex items-center gap-2.5 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Reports to <span className="font-medium">{manager.full_name || "Unnamed"}</span></span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
