import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJobProfile } from "../lib/local-job-parser";
import { createLocalResumeDraft } from "../lib/local-resume-parser";
import { assembleAnalysis, createLocalSemanticEvaluation } from "../lib/match-analysis";
import { createLocalTailoredDraft, validateAndAssembleTailoredResume } from "../lib/resume-tailoring";

const resume = createLocalResumeDraft(`
Casey Student
casey@example.com

Skills
Languages: JavaScript, TypeScript
Tools: React.js, Node.js, AWS, Git

Technical Experience
Software Development Intern — Source Company LLC
Apr 2025 – Aug 2025
– Built a React.js dashboard and Node.js REST APIs.
– Deployed the application on AWS, improving release speed by 25%.
`, "resume.txt");

const job = createLocalJobProfile({
  company: "Target Corporation",
  title: "Software Engineering Intern",
  url: "",
  description: `
Responsibilities
• Build React applications and REST APIs.
Required Qualifications
• Experience with React, TypeScript, and Git.
Preferred Qualifications
• Familiarity with UVM and Docker is a plus.
`,
});
const analysis = assembleAnalysis(resume, job, createLocalSemanticEvaluation(resume, job), "deterministic-local");

test("local tailoring cites each bullet and preserves locked fact metadata", () => {
  const tailored = validateAndAssembleTailoredResume(resume, job, createLocalTailoredDraft(resume, job, analysis), "local");
  assert.equal(tailored.validation.valid, true);
  assert.equal(tailored.entries[0].title, "Software Development Intern");
  assert.equal(tailored.entries[0].organization, "Source Company LLC");
  assert.equal(tailored.entries[0].startDate, "Apr 2025");
  assert.ok(tailored.entries[0].bullets.every(bullet => bullet.sourceFactIds.includes(tailored.entries[0].sourceFactId)));
});

test("flags unsupported tools, companies, and metrics even when a valid fact id is cited", () => {
  const maliciousDraft = {
    selectedSkills: ["React.js", "UVM"],
    omittedFactIds: [],
    entries: [{
      sourceFactId: "fact-experience-1",
      whyIncluded: "Relevant software work.",
      bullets: [{
        id: "bad-1",
        text: "Built UVM verification systems for the invented Quantum Planner at Target Corporation and improved coverage by 40%.",
        sourceFactIds: ["fact-experience-1"],
        sourceRequirementIds: [],
        whyChanged: "Targeted wording.",
      }],
    }],
  };
  const tailored = validateAndAssembleTailoredResume(resume, job, maliciousDraft, "ai");
  const issues = tailored.entries[0].bullets[0].validation.issues.join(" ");
  assert.equal(tailored.validation.valid, false);
  assert.match(issues, /UVM/);
  assert.match(issues, /Target Corporation/);
  assert.match(issues, /40%/);
  assert.match(issues, /Quantum Planner/);
  assert.ok(!tailored.selectedSkills.includes("UVM"));
  assert.equal(tailored.entries[0].organization, "Source Company LLC");
});

test("rejects unknown source ids instead of constructing new resume entries", () => {
  const tailored = validateAndAssembleTailoredResume(resume, job, {
    selectedSkills: [], omittedFactIds: [], entries: [{ sourceFactId: "invented-project", whyIncluded: "", bullets: [] }],
  }, "ai");
  assert.equal(tailored.entries.length, 0);
  assert.equal(tailored.validation.valid, false);
  assert.match(tailored.validation.issues.join(" "), /Unknown source fact/);
});
