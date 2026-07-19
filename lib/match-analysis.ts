import type { EvidenceMatch, MatchAnalysis, SemanticEvaluation } from "./analysis-schema";
import type { JobProfile, JobRequirement } from "./job-schema";
import { corpusContains, normalizeKeyword, uniqueKeywords } from "./keyword-normalization";
import type { ResumeFact, ResumeProfile } from "./resume-schema";

const RELATED_GROUPS = [
  ["javascript", "typescript", "react", "node.js", "next.js"],
  ["verilog", "systemverilog", "fpga", "digital logic", "computer architecture"],
  ["ai", "ml", "llm", "nlp", "pytorch", "tensorflow"],
  ["aws", "azure", "gcp", "cloud computing", "docker", "kubernetes"],
  ["sql", "postgresql", "firebase"],
  ["leadership", "teamwork", "collaboration", "communication"],
];

export function calculateKeywordCoverage(resume: ResumeProfile, job: JobProfile) {
  const corpus = resumeCorpus(resume);
  const keywords = uniqueKeywords(job.keywords);
  const matched = keywords.filter(keyword => corpusContains(corpus, keyword));
  const missing = keywords.filter(keyword => !matched.includes(keyword));
  return {
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
    matched,
    missing,
    total: keywords.length,
  };
}

export function createLocalSemanticEvaluation(resume: ResumeProfile, job: JobProfile): SemanticEvaluation {
  const technicalRequirements = job.requirements.filter(requirement => requirement.kind === "required_skill" || requirement.kind === "preferred_skill" || requirement.kind === "tool");
  const evidenceMatches = technicalRequirements.map(requirement => matchTechnicalRequirement(requirement, resume));
  const technicalWeights = technicalRequirements.map(requirement => requirement.kind === "required_skill" ? 2 : requirement.kind === "preferred_skill" ? 1 : .5);
  const technicalPoints = evidenceMatches.reduce((sum, match, index) => sum + matchValue(match.status) * technicalWeights[index], 0);
  const technicalTotal = technicalWeights.reduce((sum, weight) => sum + weight, 0);
  const technicalScore = technicalTotal ? Math.round((technicalPoints / technicalTotal) * 100) : 0;

  const experienceRequirements = job.requirements.filter(requirement => requirement.kind === "responsibility" || requirement.kind === "experience");
  const experienceMatches = experienceRequirements.map(requirement => matchExperienceRequirement(requirement, resume));
  const experienceScore = experienceMatches.length
    ? Math.round(experienceMatches.reduce((sum, match) => sum + matchValue(match.status), 0) / experienceMatches.length * 100)
    : relevantFactBaseline(resume, technicalRequirements);

  const allMatches = [...evidenceMatches, ...experienceMatches];
  const strengths = allMatches.filter(match => match.status === "matched").slice(0, 5).map(match => `${match.requirement}: ${match.explanation}`);
  const gaps = allMatches.filter(match => match.status === "gap").slice(0, 6).map(match => `${match.requirement}: ${match.explanation}`);
  const transferable = allMatches.filter(match => match.status === "transferable").slice(0, 3).map(match => `${match.requirement}: ${match.explanation}`);
  const risks = [
    ...job.experienceExpectations.filter(expectation => !experienceMatches.some(match => match.requirement === expectation && match.status === "matched")).map(expectation => `The posting states “${expectation}”; verify that your timeline supports it.`),
    ...transferable.map(item => `Transferable—not direct—evidence: ${item}`),
  ].slice(0, 5);

  return {
    technicalScore,
    experienceScore,
    strengths: strengths.length ? strengths : ["Your confirmed resume provides a usable evidence base for comparison."],
    gaps,
    risks,
    evidenceMatches: allMatches,
    technicalExplanation: technicalRequirements.length
      ? `${evidenceMatches.filter(match => match.status === "matched").length} direct, ${evidenceMatches.filter(match => match.status === "transferable").length} transferable, and ${evidenceMatches.filter(match => match.status === "gap").length} missing technical requirements; required skills count twice.`
      : "No explicit technical requirements were detected in the posting.",
    experienceExplanation: experienceRequirements.length
      ? `${experienceMatches.filter(match => match.status !== "gap").length} of ${experienceMatches.length} responsibility or experience expectations have direct or transferable resume evidence.`
      : "No explicit responsibility or years-of-experience statements were detected; the score uses the relevance of confirmed experience, project, and research facts.",
  };
}

export function assembleAnalysis(resume: ResumeProfile, job: JobProfile, semantic: SemanticEvaluation, evaluator: MatchAnalysis["evaluator"]): MatchAnalysis {
  const keyword = calculateKeywordCoverage(resume, job);
  const technical = clampScore(semantic.technicalScore);
  const experience = clampScore(semantic.experienceScore);
  const overall = Math.round(technical * .45 + experience * .30 + keyword.score * .25);
  return {
    scores: { overall, technical, experience, keyword: keyword.score },
    strengths: semantic.strengths,
    gaps: semantic.gaps.length ? semantic.gaps : ["No explicit gaps were detected; review every requirement before applying."],
    risks: semantic.risks,
    evidenceMatches: semantic.evidenceMatches,
    matchedKeywords: keyword.matched,
    missingKeywords: keyword.missing,
    scoreExplanation: {
      technical: semantic.technicalExplanation,
      experience: semantic.experienceExplanation,
      keyword: `${keyword.matched.length} of ${keyword.total} normalized job keywords appear in confirmed resume evidence. Duplicates and aliases are counted once.`,
      overall: `(${technical} × 45%) + (${experience} × 30%) + (${keyword.score} × 25%) = ${overall}.`,
    },
    evaluator,
  };
}

function matchTechnicalRequirement(requirement: JobRequirement, resume: ResumeProfile): EvidenceMatch {
  const directFacts = findFacts(resume.facts, requirement.label);
  const direct = corpusContains(resumeCorpus(resume), requirement.label);
  if (direct) return {
    requirementId: requirement.id,
    requirement: requirement.label,
    status: "matched",
    sourceFactIds: directFacts.map(fact => fact.id),
    evidence: directFacts.length ? directFacts.map(factLabel) : resume.skills.filter(skill => normalizeKeyword(skill) === normalizeKeyword(requirement.label)),
    explanation: directFacts.length ? `Directly supported by ${directFacts.map(fact => fact.title || fact.organization).filter(Boolean).join(", ")}.` : "Listed directly in the confirmed skills profile.",
  };

  const related = relatedKeywords(requirement.label).filter(keyword => corpusContains(resumeCorpus(resume), keyword));
  if (related.length) {
    const relatedFacts = resume.facts.filter(fact => related.some(keyword => corpusContains(factCorpus(fact), keyword)));
    return { requirementId: requirement.id, requirement: requirement.label, status: "transferable", sourceFactIds: relatedFacts.map(fact => fact.id), evidence: relatedFacts.map(factLabel), explanation: `Related evidence exists in ${uniqueKeywords(related).join(", ")}, but “${requirement.label}” is not stated directly.` };
  }
  return { requirementId: requirement.id, requirement: requirement.label, status: "gap", sourceFactIds: [], evidence: [], explanation: "No confirmed resume fact directly supports this requirement." };
}

function matchExperienceRequirement(requirement: JobRequirement, resume: ResumeProfile): EvidenceMatch {
  if (requirement.kind === "experience") {
    return { requirementId: requirement.id, requirement: requirement.label, status: "gap", sourceFactIds: [], evidence: [], explanation: "The app does not infer total years from overlapping or partial dates; verify this requirement manually." };
  }
  const requirementTokens = significantTokens(requirement.label);
  const ranked = resume.facts.map(fact => ({ fact, score: overlap(requirementTokens, significantTokens(factCorpus(fact))) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best && best.score >= .28) return { requirementId: requirement.id, requirement: requirement.label, status: "matched", sourceFactIds: [best.fact.id], evidence: [factLabel(best.fact)], explanation: `The wording and concepts align with confirmed evidence from ${best.fact.title || best.fact.organization}.` };
  if (best && best.score >= .12) return { requirementId: requirement.id, requirement: requirement.label, status: "transferable", sourceFactIds: [best.fact.id], evidence: [factLabel(best.fact)], explanation: `Related experience appears in ${best.fact.title || best.fact.organization}, but the resume does not state the responsibility directly.` };
  return { requirementId: requirement.id, requirement: requirement.label, status: "gap", sourceFactIds: [], evidence: [], explanation: "No sufficiently similar responsibility was found in confirmed resume evidence." };
}

function resumeCorpus(resume: ResumeProfile) { return [resume.summary, ...resume.skills, ...resume.keywords, ...resume.facts.map(factCorpus)].join(" "); }
function factCorpus(fact: ResumeFact) { return [fact.title, fact.organization, ...fact.details, ...fact.keywords].join(" "); }
function factLabel(fact: ResumeFact) { return [fact.title, fact.organization].filter(Boolean).join(" — "); }
function findFacts(facts: ResumeFact[], keyword: string) { return facts.filter(fact => corpusContains(factCorpus(fact), keyword)); }
function matchValue(status: EvidenceMatch["status"]) { return status === "matched" ? 1 : status === "transferable" ? .65 : 0; }
function clampScore(score: number) { return Math.max(0, Math.min(100, Math.round(score))); }
function relatedKeywords(keyword: string) { const normalized = normalizeKeyword(keyword); return RELATED_GROUPS.find(group => group.includes(normalized))?.filter(value => value !== normalized) ?? []; }
function significantTokens(value: string) { return new Set(normalizeKeyword(value).split(/\s+/).filter(token => token.length > 3 && !STOP_WORDS.has(token))); }
function overlap(source: Set<string>, target: Set<string>) { if (!source.size) return 0; return [...source].filter(token => target.has(token)).length / source.size; }
function relevantFactBaseline(resume: ResumeProfile, requirements: JobRequirement[]) {
  const relevant = resume.facts.filter(fact => ["experience", "projects", "research"].includes(fact.section) && requirements.some(req => relatedKeywords(req.label).some(keyword => corpusContains(factCorpus(fact), keyword)) || corpusContains(factCorpus(fact), req.label)));
  return Math.min(85, relevant.length * 18 + (resume.facts.some(fact => fact.section === "experience") ? 20 : 0));
}
const STOP_WORDS = new Set(["with", "that", "this", "from", "your", "their", "will", "have", "using", "work", "role", "team", "into", "such", "about", "years", "experience", "knowledge", "strong", "ability", "including"]);

