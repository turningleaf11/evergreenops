import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { departments as defaultDepartments, type Department } from "@/lib/mock-data";

interface DepartmentsContextValue {
  departments: Department[];
  addDepartment: (dept: Omit<Department, "id">) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
}

const STORAGE_KEY = "departments-data";

function loadDepartments(): Department[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultDepartments;
}

function saveDepartments(depts: Department[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(depts));
}

const DepartmentsContext = createContext<DepartmentsContextValue | null>(null);

export function DepartmentsProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>(loadDepartments);

  const persist = useCallback((depts: Department[]) => {
    setDepartments(depts);
    saveDepartments(depts);
  }, []);

  const addDepartment = useCallback((dept: Omit<Department, "id">) => {
    setDepartments((prev) => {
      const next = [...prev, { ...dept, id: `dept_${Date.now()}` }];
      saveDepartments(next);
      return next;
    });
  }, []);

  const updateDepartment = useCallback((id: string, updates: Partial<Department>) => {
    setDepartments((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, ...updates } : d));
      saveDepartments(next);
      return next;
    });
  }, []);

  const deleteDepartment = useCallback((id: string) => {
    setDepartments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDepartments(next);
      return next;
    });
  }, []);

  return (
    <DepartmentsContext.Provider value={{ departments, addDepartment, updateDepartment, deleteDepartment }}>
      {children}
    </DepartmentsContext.Provider>
  );
}

export function useDepartments() {
  const ctx = useContext(DepartmentsContext);
  if (!ctx) throw new Error("useDepartments must be used within DepartmentsProvider");
  return ctx;
}
