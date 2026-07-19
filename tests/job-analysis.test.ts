import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJobProfile } from "../lib/local-job-parser";
import { createLocalResumeDraft } from "../lib/local-resume-parser";
import { corpusContains } from "../lib/keyword-normalization";
import { assembleAnalysis, calculateKeywordCoverage, createLocalSemanticEvaluation } from "../lib/match-analysis";

const resume = createLocalResumeDraft(`
Casey Student
casey@example.com

Skills
Languages: Python, JavaScript, TypeScript
Tools: React.js, Node.js, Firebase, Docker, AWS, Git

Technical Experience
Software Development Intern — Example Technologies LLC
Apr 2025 – Aug 2025
– Built a React.js dashboard and Node.js REST APIs with Firebase.
– Containerized the application with Docker and deployed it on AWS.
Coding Instructor — Learning Center
May 2023 – Present
– Taught JavaScript and collaborated with students on programming projects.
`, "resume.txt");

const job = createLocalJobProfile({
  company: "Example Systems",
  title: "Software Engineering Intern",
  url: "",
  description: `
Responsibilities
• Build and maintain React applications and REST APIs.
• Collaborate with engineers to deploy cloud services.

Required Qualifications
• Proficiency with JavaScript or TypeScript and React.
• Experience with AWS and Git.

Preferred Qualifications
• Familiarity with Docker and Python.
• Exposure to UVM is a plus.
• Strong communication skills.
`,
});

test("parses required and preferred job skills without duplicates", () => {
  assert.ok(job.requiredSkills.includes("JavaScript"));
  assert.ok(job.requiredSkills.includes("TypeScript"));
  assert.ok(job.requiredSkills.includes("React"));
  assert.ok(job.requiredSkills.includes("AWS"));
  assert.ok(job.preferredSkills.includes("Docker"));
  assert.ok(job.preferredSkills.includes("Python"));
  assert.ok(job.preferredSkills.includes("UVM"));
  assert.equal(job.responsibilities.length, 2);
  assert.ok(job.requirements.every(requirement => requirement.id.startsWith("req-")));
});

test("calculates deterministic normalized keyword coverage", () => {
  const coverage = calculateKeywordCoverage(resume, job);
  assert.ok(coverage.matched.includes("React"));
  assert.ok(coverage.matched.includes("AWS"));
  assert.ok(coverage.missing.includes("UVM"));
  assert.equal(coverage.total, coverage.matched.length + coverage.missing.length);
});

test("does not count short keywords inside unrelated words", () => {
  assert.equal(corpusContains("Maintained client projects", "AI"), false);
  assert.equal(corpusContains("Built a React.js dashboard", "React"), true);
  assert.equal(corpusContains("Coordinated releases", "C"), false);
});

test("uses the 45/30/25 score and traces matches to confirmed source ids", () => {
  const analysis = assembleAnalysis(resume, job, createLocalSemanticEvaluation(resume, job), "deterministic-local");
  const expected = Math.round(analysis.scores.technical * .45 + analysis.scores.experience * .30 + analysis.scores.keyword * .25);
  assert.equal(analysis.scores.overall, expected);
  assert.match(analysis.scoreExplanation.overall, /45%/);
  const reactMatch = analysis.evidenceMatches.find(match => match.requirement === "React");
  assert.equal(reactMatch?.status, "matched");
  assert.ok(reactMatch?.sourceFactIds.includes("fact-experience-1"));
  const uvmMatch = analysis.evidenceMatches.find(match => match.requirement === "UVM");
  assert.equal(uvmMatch?.status, "gap");
  assert.deepEqual(uvmMatch?.sourceFactIds, []);
});
