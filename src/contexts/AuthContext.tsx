import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "user";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  workspace_id: string | null;
  time_clock_enabled: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole;
  isAdmin: boolean;
  /** True only for the primary admin (the workspace CEO). Used to gate the CEO Cockpit. */
  isPrimaryAdmin: boolean;
  loading: boolean;
  /** True once both profile and user_roles queries have completed for the current user. */
  roleLoaded: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setRoleLoaded(false);
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role, is_primary").eq("user_id", userId),
      ]);

      const profileData = profileRes.data;
      const roleData = roleRes.data;

      if (profileData) {
        setProfile(profileData as Profile);
      }

      if (roleData && roleData.length > 0) {
        const roles = roleData.map((r: any) => r.role);
        setRole(roles.includes("admin") ? "admin" : "user");
        setIsPrimaryAdmin(roleData.some((r: any) => r.role === "admin" && r.is_primary === true));
      } else {
        setRole("user");
        setIsPrimaryAdmin(false);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setRoleLoaded(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRole("user");
          setIsPrimaryAdmin(false);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        fetchProfile(existingSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("user");
    setIsPrimaryAdmin(false);
  }, []);

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isAdmin, isPrimaryAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
