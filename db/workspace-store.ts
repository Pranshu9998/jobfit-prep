import { StorageDocumentSchema, type StorageDocument } from "../lib/browser-storage";
import type { BetaUser } from "../lib/beta-auth";
import { createSupabaseServerClient } from "../lib/supabase/server";

function fail(message: string, error?: { message?: string } | null): never {
  throw new Error(error?.message || message);
}

export async function readWorkspace(user: BetaUser): Promise<StorageDocument | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("user_workspaces").select("document_json").eq("user_id", user.id).maybeSingle();
  if (error) fail("The workspace could not be loaded.", error);
  if (!data) return null;
  const raw = typeof data.document_json === "string" ? JSON.parse(data.document_json) : data.document_json;
  const parsed = StorageDocumentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function writeWorkspace(user: BetaUser, document: StorageDocument) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error: workspaceError } = await supabase.from("user_workspaces").upsert({
    user_id: user.id, version: document.version, document_json: document, updated_at: now,
  }, { onConflict: "user_id" });
  if (workspaceError) fail("The workspace could not be saved.", workspaceError);

  if (document.recentPrepPacks.length) {
    const rows = document.recentPrepPacks.map(pack => ({
      id: pack.id, user_id: user.id, company: pack.job.company, job_title: pack.job.title,
      payload_json: pack, created_at: pack.createdAt, updated_at: now,
    }));
    const { error } = await supabase.from("prep_packs").upsert(rows, { onConflict: "user_id,id" });
    if (error) fail("Recent prep packs could not be saved.", error);
  }
}

export async function deleteWorkspace(user: BetaUser) {
  const supabase = await createSupabaseServerClient();
  const { error: packError } = await supabase.from("prep_packs").delete().eq("user_id", user.id);
  if (packError) fail("Prep packs could not be deleted.", packError);
  const { error } = await supabase.from("user_workspaces").delete().eq("user_id", user.id);
  if (error) fail("The workspace could not be deleted.", error);
}

export async function consumeDailyAiAllowance(user: BetaUser, limit = 25) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("consume_daily_ai_allowance", { p_limit: limit });
  if (error) fail("Usage verification is unavailable.", error);
  const result = Array.isArray(data) ? data[0] : data;
  const used = Number(result?.used ?? limit + 1);
  return { allowed: Boolean(result?.allowed), used, limit, resetsAt: String(result?.resets_at ?? "") };
}
