import { createSupabaseServerClient } from "./supabase/server";

export type BetaUser = { id: string; displayName: string; email: string; fullName: string | null; localDev: false };

export async function getBetaUser(): Promise<BetaUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { id: user.id, email: user.email, fullName, displayName: fullName || user.email, localDev: false };
}

export async function requireBetaApiUser() {
  const user = await getBetaUser();
  if (!user) return { user: null, response: Response.json({ error: "Sign in is required." }, { status: 401 }) } as const;
  return { user, response: null } as const;
}

export function betaSignInPath(returnTo = "/") {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
