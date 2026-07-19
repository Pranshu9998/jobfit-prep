import assert from "node:assert/strict";
import test from "node:test";
import { createLocalInterviewPack } from "../lib/interview-generation";
import { createLocalJobProfile } from "../lib/local-job-parser";
import { createLocalResumeDraft } from "../lib/local-resume-parser";
import { assembleAnalysis, createLocalSemanticEvaluation } from "../lib/match-analysis";
import { createInterviewPdfBlob, createResumePdfBlob } from "../lib/pdf-download";
import { createLocalTailoredDraft, validateAndAssembleTailoredResume } from "../lib/resume-tailoring";

test("creates valid resume and interview PDF blobs from the latest content", async () => {
  const resume = createLocalResumeDraft(`
Jordan Lee
jordan@example.com
Skills
Languages: Python, TypeScript
Experience
Software Engineering Intern — Example Labs
May 2025 – Aug 2025
– Built a TypeScript testing dashboard that reduced manual review time by 25%.
`, "resume.txt");
  const job = createLocalJobProfile({ company: "Vertex Computing", title: "Software Engineering Intern", url: "", description: `
Required qualifications
Experience with TypeScript, Python, Git, and Linux.
Responsibilities
Build testing dashboards and automation for engineering teams. Debug software failures and communicate technical tradeoffs.
Preferred qualifications
React and regression testing experience.
` });
  const analysis = assembleAnalysis(resume, job, createLocalSemanticEvaluation(resume, job), "deterministic-local");
  const tailored = validateAndAssembleTailoredResume(resume, job, createLocalTailoredDraft(resume, job, analysis), "local");
  const pack = createLocalInterviewPack(resume, job, analysis);

  const [resumeBlob, interviewBlob] = await Promise.all([
    createResumePdfBlob(tailored, job),
    createInterviewPdfBlob(pack, job, resume.name),
  ]);
  for (const blob of [resumeBlob, interviewBlob]) {
    assert.equal(blob.type, "application/pdf");
    assert.ok(blob.size > 1_000);
    const signature = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 4));
    assert.equal(signature, "%PDF");
  }
});
