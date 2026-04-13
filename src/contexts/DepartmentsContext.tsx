import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
}

interface DepartmentsContextValue {
  departments: Department[];
  loading: boolean;
  addDepartment: (dept: Omit<Department, "id" | "sort_order">) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  refetch: () => void;
}

const DepartmentsContext = createContext<DepartmentsContextValue | null>(null);

export function DepartmentsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("departments")
      .select("*")
      .order("sort_order", { ascending: true });

    if (data) {
      setDepartments(
        data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description || "",
          icon: d.icon || "Building2",
          color: d.color || "220 65% 48%",
          sort_order: d.sort_order || 0,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const addDepartment = useCallback(async (dept: Omit<Department, "id" | "sort_order">) => {
    const { data } = await supabase
      .from("departments")
      .insert({
        name: dept.name,
        description: dept.description,
        icon: dept.icon,
        color: dept.color,
        sort_order: departments.length,
      })
      .select()
      .single();

    if (data) {
      setDepartments((prev) => [...prev, {
        id: data.id,
        name: data.name,
        description: data.description || "",
        icon: data.icon || "Building2",
        color: data.color || "220 65% 48%",
        sort_order: data.sort_order || 0,
      }]);
    }
  }, [departments.length]);

  const updateDepartment = useCallback(async (id: string, updates: Partial<Department>) => {
    setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    await supabase.from("departments").update(updates as any).eq("id", id);
  }, []);

  const deleteDepartment = useCallback(async (id: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    await supabase.from("departments").delete().eq("id", id);
  }, []);

  return (
    <DepartmentsContext.Provider value={{ departments, loading, addDepartment, updateDepartment, deleteDepartment, refetch: fetchDepartments }}>
      {children}
    </DepartmentsContext.Provider>
  );
}

export function useDepartments() {
  const ctx = useContext(DepartmentsContext);
  if (!ctx) throw new Error("useDepartments must be used within DepartmentsProvider");
  return ctx;
}
