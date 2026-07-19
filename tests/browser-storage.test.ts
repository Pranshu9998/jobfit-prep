import assert from "node:assert/strict";
import test from "node:test";
import { JOBFIT_STORAGE_KEY, clearJobFitStorage, migrateStorageDocument, recoverableStage, saveJobFitStorage, type WorkspaceSnapshot } from "../lib/browser-storage";

const emptyWorkspace: WorkspaceSnapshot = {
  stage: "resume", inputMode: "upload", resumeText: "", sourceName: "Pasted resume", profile: null, jobInput: null,
  job: null, analysis: null, generatedTailored: null, tailored: null, interviewPack: null,
};

test("saves one versioned document and clears it", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const saved = saveJobFitStorage(storage, emptyWorkspace, []);
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.document.version, 1);
  const parsed = migrateStorageDocument(storage.getItem(JOBFIT_STORAGE_KEY));
  assert.equal(parsed?.version, 1);
  assert.equal(parsed?.workspace.stage, "resume");
  assert.equal(clearJobFitStorage(storage), true);
  assert.equal(storage.getItem(JOBFIT_STORAGE_KEY), null);
});

test("safely rejects malformed and incompatible documents", () => {
  assert.equal(migrateStorageDocument("not json"), null);
  assert.equal(migrateStorageDocument(JSON.stringify({ version: 99, workspace: {} })), null);
});

test("reports quota recovery and rolls incomplete stages backward", () => {
  const storage = { setItem: () => { const error = new Error("full"); error.name = "QuotaExceededError"; throw error; } };
  assert.deepEqual(saveJobFitStorage(storage, emptyWorkspace, []), { ok: false, reason: "quota" });
  assert.equal(recoverableStage({ ...emptyWorkspace, stage: "interview" }), "resume");
});
