// Updated to use Supabase authentication instead of Lovable.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

/**
 * Auth helper that mirrors the previous Lovable interface but uses Supabase.
 * Provider mapping: "google" -> "google", "apple" -> "apple", "microsoft" -> "azure".
 */
export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft",
      opts?: SignInOptions
    ) => {
      // Map provider name to Supabase's expected provider string
      const supabaseProvider: any =
        provider === "microsoft" ? "azure" : provider;

      const result = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider,
        options: {
          redirectTo: opts?.redirect_uri,
          // Supabase supports query params via the "scope" or "access_type" options,
          // but extraParams can be passed through "redirectTo" query string if needed.
          // Here we simply ignore extraParams or you could append them manually.
        },
      });

      // Supabase returns { data, error }. Align with previous shape.
      if (result.error) {
        return { error: result.error };
      }
      // Successful sign‑in returns data.session (may be null if redirect).
      return { data: result.data, error: null };
    },
  },
};
