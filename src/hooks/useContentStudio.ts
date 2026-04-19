import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface ContentBrand {
  id: string;
  name: string;
  color: string;
  audience: string;
  voice: string;
  mission: string;
  seeds: string[];
  canva_kit_id: string | null;
  sort_order: number;
}

export interface LibraryItem {
  id: string;
  brand_id: string | null;
  brand_name: string;
  brand_color: string;
  platform: string;
  platform_label: string;
  content: string;
  seed: string;
  image_url: string | null;
  status: "draft" | "approved" | "posted" | "archived";
  canva_url: string | null;
  created_at: string;
}

const DEFAULT_SEED_BRANDS: Omit<ContentBrand, "id" | "sort_order">[] = [
  {
    name: "Autumn Alexander",
    color: "#0F6E56",
    audience: "aspiring investors, fellow operators, entrepreneurs, community followers",
    voice: `SHORT — 1-2 sentences. React, don't lecture. Casual humor. Warm but understated. No fake motivation. Real examples: "Not the milk coming out of the faucet though lol 😏" / "Ok, I'll play 😁" / "Just a little Christmas magic...(the AI kind) ✨"`,
    mission: "Personal brand — transparent real estate entrepreneur, educator, community builder",
    seeds: ["something real I learned this week", "deal update — got something under contract", "behind the scenes — team life", "a question a seller asked me", "creative financing tip"],
    canva_kit_id: null,
  },
  {
    name: "Evergreen Home Group",
    color: "#854F0B",
    audience: "motivated sellers in TX, FL, GA, NC, VA, TN, KY, AL who need to sell",
    voice: "Trustworthy, warm, straightforward. Speaks to homeowners in distress or transition. Not pushy. Human and professional. Make sellers feel safe.",
    mission: "Generate seller leads — selling is simple, fast, stress-free with us",
    seeds: ["how our process works", "we can close in 2 weeks", "no repairs needed", "seller success story", "market update"],
    canva_kit_id: null,
  },
  {
    name: "Evergreen RE Ventures",
    color: "#534AB7",
    audience: "cash buyers, end investors, capital partners, JV partners, fellow operators",
    voice: "Professional, deal-focused, credibility-forward. Numbers and specifics. Confident but relationship-oriented. Operator talking to operators.",
    mission: "Attract buyers, capital partners, JV relationships through deal flow and credibility",
    seeds: ["new deal available", "our buy box across 8 states", "creative deal structure", "capital partner opportunity", "portfolio update"],
    canva_kit_id: null,
  },
];

export function useContentBrands() {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const [brands, setBrands] = useState<ContentBrand[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("content_brands")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order");

    if (data && data.length === 0) {
      // Seed defaults on first load
      const rows = DEFAULT_SEED_BRANDS.map((b, i) => ({
        ...b,
        user_id: user.id,
        workspace_id: workspaceId,
        sort_order: i,
      }));
      const { data: inserted } = await supabase.from("content_brands").insert(rows).select();
      setBrands((inserted || []) as any);
    } else {
      setBrands((data || []) as any);
    }
    setLoading(false);
  }, [user, workspaceId]);

  useEffect(() => { refetch(); }, [refetch]);

  const create = async (brand: Omit<ContentBrand, "id" | "sort_order">) => {
    if (!user) return;
    const { data } = await supabase
      .from("content_brands")
      .insert({ ...brand, user_id: user.id, workspace_id: workspaceId, sort_order: brands.length })
      .select()
      .single();
    if (data) setBrands((p) => [...p, data as any]);
  };

  const update = async (id: string, patch: Partial<ContentBrand>) => {
    setBrands((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    await supabase.from("content_brands").update(patch).eq("id", id);
  };

  const remove = async (id: string) => {
    setBrands((p) => p.filter((b) => b.id !== id));
    await supabase.from("content_brands").delete().eq("id", id);
  };

  return { brands, loading, create, update, remove, refetch };
}

export function useContentLibrary() {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("content_library")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = async (item: Omit<LibraryItem, "id" | "created_at">) => {
    if (!user) return null;
    const { data } = await supabase
      .from("content_library")
      .insert({ ...item, user_id: user.id, workspace_id: workspaceId })
      .select()
      .single();
    if (data) setItems((p) => [data as any, ...p]);
    return data;
  };

  const updateStatus = async (id: string, status: LibraryItem["status"]) => {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, status } : it)));
    await supabase.from("content_library").update({ status }).eq("id", id);
  };

  const remove = async (id: string) => {
    setItems((p) => p.filter((it) => it.id !== id));
    await supabase.from("content_library").delete().eq("id", id);
  };

  const clearArchived = async () => {
    if (!user) return;
    await supabase.from("content_library").delete().eq("user_id", user.id).eq("status", "archived");
    setItems((p) => p.filter((it) => it.status !== "archived"));
  };

  return { items, loading, save, updateStatus, remove, clearArchived, refetch };
}
