import { createClient } from "@supabase/supabase-js";

let browserClient = null;

function isConfigured(value) {
  return Boolean(value && !/replace_me|your-project/i.test(value));
}

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!isConfigured(url) || !isConfigured(key)) return null;
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) return null;
  } catch { return null; }
  if (key.startsWith("sb_secret_")) return null;
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return browserClient;
}
