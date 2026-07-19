import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = configuration();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot always write refreshed cookies; proxy.ts handles refresh. */ }
      },
    },
  });
}
