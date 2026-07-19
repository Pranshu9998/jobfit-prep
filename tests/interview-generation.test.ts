import assert from "node:assert/strict";
import test from "node:test";
import { createLocalInterviewPack, sanitizeInterviewPack } from "../lib/interview-generation";
import { createLocalJobProfile } from "../lib/local-job-parser";
import { createLocalResumeDraft } from "../lib/local-resume-parser";
import { assembleAnalysis, createLocalSemanticEvaluation } from "../lib/match-analysis";

const resume = createLocalResumeDraft(`
Jordan Lee
jordan@example.com
Skills
Languages: Python, TypeScript
Tools: React.js, Docker, AWS, Git
Experience
Software Engineering Intern — Example LLC
May 2025 – Aug 2025
– Built a React.js dashboard and deployed it with Docker on AWS.
Leadership
Robotics Team — Hardware Lead
Aug 2023 – Present
– Led testing and coordinated a six-person build team.
`, "resume.txt");
const job = createLocalJobProfile({ company: "Target Labs", title: "Engineering Intern", url: "", description: `
Responsibilities
• Build and test React applications with engineering teams.
Required Qualifications
• Experience with React, TypeScript, AWS, and Git.
Preferred Qualifications
• Familiarity with Docker and Python.
• Strong collaboration and communication skills.
` });
const analysis = assembleAnalysis(resume, job, createLocalSemanticEvaluation(resume, job), "deterministic-local");

test("generates all three interview question categories with visible provenance", () => {
  const pack = createLocalInterviewPack(resume, job, analysis);
  assert.ok(pack.questions.some(question => question.type === "technical"));
  assert.ok(pack.questions.some(question => question.type === "resume"));
  assert.ok(pack.questions.some(question => question.type === "behavioral"));
  assert.ok(pack.questions.every(question => question.evidence.length > 0));
  assert.ok(pack.questions.every(question => question.preparationOutline.length >= 4));
  assert.ok(pack.questions.some(question => question.tag === "both"));
  assert.ok(pack.prepSheet.prioritySkills.length > 0);
  assert.ok(pack.prepSheet.strongestStories.length > 0);
});

test("removes hallucinated source ids from generated interview questions", () => {
  const pack = createLocalInterviewPack(resume, job, analysis);
  pack.questions[0].sourceFactIds.push("invented-fact");
  pack.questions[0].sourceRequirementIds.push("invented-requirement");
  pack.prepSheet.openingPitch = "Invented ownership and customer feedback.";
  pack.questions[0].evidence = ["Invented evidence"];
  const sanitized = sanitizeInterviewPack(pack, resume, job, analysis, "ai");
  assert.ok(!sanitized.questions[0].sourceFactIds.includes("invented-fact"));
  assert.ok(!sanitized.questions[0].sourceRequirementIds.includes("invented-requirement"));
  assert.ok(!sanitized.questions[0].evidence.includes("Invented evidence"));
  assert.ok(!sanitized.prepSheet.openingPitch.includes("Invented ownership"));
});
