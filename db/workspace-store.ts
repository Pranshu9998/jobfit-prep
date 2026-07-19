import { env } from "cloudflare:workers";
import { StorageDocumentSchema, type StorageDocument } from "../lib/browser-storage";
import type { BetaUser } from "../lib/beta-auth";

let schemaReady: Promise<void> | null = null;

function database() {
  if (!env.DB) throw new Error("The beta database is unavailable.");
  return env.DB;
}

export function ensureBetaSchema() {
  if (schemaReady) return schemaReady;
  const db = database();
  schemaReady = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_workspaces (
      user_email TEXT PRIMARY KEY NOT NULL,
      version INTEGER NOT NULL,
      document_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS prep_packs (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      company TEXT NOT NULL,
      job_title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS prep_packs_user_created_idx ON prep_packs(user_email, created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS usage_counters (
      user_email TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_email, usage_date),
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    )`),
  ]).then(() => undefined).catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}

export async function consumeDailyAiAllowance(user: BetaUser, limit = 25) {
  await ensureBetaSchema();
  const db = database();
  const now = new Date();
  const usageDate = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString();
  await db.prepare(`INSERT INTO users (email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`).bind(user.email, user.displayName, timestamp, timestamp).run();
  const row = await db.prepare(`INSERT INTO usage_counters (user_email, usage_date, count, updated_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(user_email, usage_date) DO UPDATE SET count = usage_counters.count + 1, updated_at = excluded.updated_at
    RETURNING count`).bind(user.email, usageDate, timestamp).first<{ count: number }>();
  const used = row?.count ?? limit + 1;
  return { allowed: used <= limit, used, limit, resetsAt: `${usageDate}T23:59:59.999Z` };
}

export async function readWorkspace(userEmail: string): Promise<StorageDocument | null> {
  await ensureBetaSchema();
  const row = await database().prepare("SELECT document_json FROM user_workspaces WHERE user_email = ? LIMIT 1").bind(userEmail).first<{ document_json: string }>();
  if (!row) return null;
  const parsed = StorageDocumentSchema.safeParse(JSON.parse(row.document_json));
  return parsed.success ? parsed.data : null;
}

export async function writeWorkspace(user: BetaUser, document: StorageDocument) {
  await ensureBetaSchema();
  const db = database();
  const now = new Date().toISOString();
  const packStatements = document.recentPrepPacks.map(pack => db.prepare(`INSERT INTO prep_packs (id, user_email, company, job_title, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
    WHERE prep_packs.user_email = excluded.user_email`).bind(pack.id, user.email, pack.job.company, pack.job.title, JSON.stringify(pack), pack.createdAt, now));
  await db.batch([
    db.prepare(`INSERT INTO users (email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`).bind(user.email, user.displayName, now, now),
    db.prepare(`INSERT INTO user_workspaces (user_email, version, document_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET version = excluded.version, document_json = excluded.document_json, updated_at = excluded.updated_at`).bind(user.email, document.version, JSON.stringify(document), now),
    ...packStatements,
  ]);
}

export async function deleteWorkspace(userEmail: string) {
  await ensureBetaSchema();
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM prep_packs WHERE user_email = ?").bind(userEmail),
    db.prepare("DELETE FROM user_workspaces WHERE user_email = ?").bind(userEmail),
  ]);
}
