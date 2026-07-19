import { z } from "zod";
import { MatchAnalysisSchema } from "./analysis-schema";
import { InterviewPackSchema } from "./interview-schema";
import { JobProfileSchema } from "./job-schema";
import { ResumeProfileSchema } from "./resume-schema";
import { TailoredResumeSchema } from "./tailored-resume-schema";

export const JOBFIT_STORAGE_KEY = "jobfit-prep:workspace";
export const JOBFIT_STORAGE_VERSION = 1;

const StageSchema = z.enum(["resume", "review", "job", "analysis", "tailor", "interview"]);
const InputModeSchema = z.enum(["upload", "paste"]);
const JobInputSchema = z.object({
  company: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string(),
});

export const RecentPrepPackSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  job: JobProfileSchema,
  analysis: MatchAnalysisSchema,
  tailoredResume: TailoredResumeSchema,
  interviewPack: InterviewPackSchema,
});

export const WorkspaceSnapshotSchema = z.object({
  stage: StageSchema,
  inputMode: InputModeSchema,
  resumeText: z.string(),
  sourceName: z.string(),
  profile: ResumeProfileSchema.nullable(),
  jobInput: JobInputSchema.nullable(),
  job: JobProfileSchema.nullable(),
  analysis: MatchAnalysisSchema.nullable(),
  generatedTailored: TailoredResumeSchema.nullable(),
  tailored: TailoredResumeSchema.nullable(),
  interviewPack: InterviewPackSchema.nullable(),
});

export const StorageDocumentSchema = z.object({
  version: z.literal(JOBFIT_STORAGE_VERSION),
  updatedAt: z.string(),
  workspace: WorkspaceSnapshotSchema,
  recentPrepPacks: z.array(RecentPrepPackSchema).max(5),
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;
export type RecentPrepPack = z.infer<typeof RecentPrepPackSchema>;
export type StorageDocument = z.infer<typeof StorageDocumentSchema>;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;
type ClearableStorage = Pick<Storage, "removeItem">;

export function migrateStorageDocument(raw: string | null): StorageDocument | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const current = StorageDocumentSchema.safeParse(parsed);
    if (current.success) return current.data;

    // Early local builds stored the workspace fields at the document root.
    if (parsed && typeof parsed === "object" && !("version" in parsed)) {
      const legacy = parsed as Record<string, unknown>;
      const migrated = StorageDocumentSchema.safeParse({
        version: JOBFIT_STORAGE_VERSION,
        updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : new Date(0).toISOString(),
        workspace: legacy.workspace ?? legacy,
        recentPrepPacks: legacy.recentPrepPacks ?? [],
      });
      return migrated.success ? migrated.data : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadJobFitStorage(storage: ReadableStorage) {
  return migrateStorageDocument(storage.getItem(JOBFIT_STORAGE_KEY));
}

export function saveJobFitStorage(storage: WritableStorage, workspace: WorkspaceSnapshot, recentPrepPacks: RecentPrepPack[]) {
  const document = StorageDocumentSchema.parse({
    version: JOBFIT_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    workspace,
    recentPrepPacks: recentPrepPacks.slice(0, 5),
  });
  try {
    storage.setItem(JOBFIT_STORAGE_KEY, JSON.stringify(document));
    return { ok: true as const, document };
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    return { ok: false as const, reason: name === "QuotaExceededError" ? "quota" as const : "unavailable" as const };
  }
}

export function clearJobFitStorage(storage: ClearableStorage) {
  try {
    storage.removeItem(JOBFIT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function recoverableStage(snapshot: WorkspaceSnapshot): WorkspaceSnapshot["stage"] {
  if (snapshot.stage === "interview" && snapshot.profile && snapshot.job && snapshot.tailored && snapshot.interviewPack) return "interview";
  if ((snapshot.stage === "interview" || snapshot.stage === "tailor") && snapshot.profile && snapshot.job && snapshot.analysis && snapshot.tailored) return "tailor";
  if (["interview", "tailor", "analysis"].includes(snapshot.stage) && snapshot.profile && snapshot.job && snapshot.analysis) return "analysis";
  if (snapshot.stage === "job" && snapshot.profile) return "job";
  if (snapshot.stage === "review" && snapshot.profile) return "review";
  return "resume";
}
