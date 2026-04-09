import React, { createContext, useContext, useState, useCallback } from "react";
import { teamMembers } from "@/lib/mock-data";

export type AppRole = "admin" | "user";

interface AuthContextType {
  currentUserId: string;
  currentUser: typeof teamMembers[0];
  role: AppRole;
  isAdmin: boolean;
  setRole: (role: AppRole) => void;
  getUserRole: (userId: string) => AppRole;
  setUserRole: (userId: string, role: AppRole) => void;
  roles: Record<string, AppRole>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const defaultRoles: Record<string, AppRole> = {
  m1: "admin", // Sarah Chen
  m2: "user",
  m3: "user",
  m4: "user",
  m5: "user",
  m6: "user",
  m7: "user",
  m8: "user",
  m9: "user",
  m10: "user",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId] = useState("m1");
  const [roles, setRoles] = useState<Record<string, AppRole>>(defaultRoles);

  const currentUser = teamMembers.find((m) => m.id === currentUserId)!;
  const role = roles[currentUserId] || "user";
  const isAdmin = role === "admin";

  const setRole = useCallback((newRole: AppRole) => {
    setRoles((prev) => ({ ...prev, [currentUserId]: newRole }));
  }, [currentUserId]);

  const getUserRole = useCallback((userId: string): AppRole => {
    return roles[userId] || "user";
  }, [roles]);

  const setUserRole = useCallback((userId: string, newRole: AppRole) => {
    setRoles((prev) => ({ ...prev, [userId]: newRole }));
  }, []);

  return (
    <AuthContext.Provider value={{ currentUserId, currentUser, role, isAdmin, setRole, getUserRole, setUserRole, roles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
