import type { MatchAnalysis } from "./analysis-schema";
import type { JobProfile } from "./job-schema";
import { corpusContains, normalizeKeyword, uniqueKeywords } from "./keyword-normalization";
import type { ResumeFact, ResumeProfile, ResumeSection } from "./resume-schema";
import type { TailoredBullet, TailoredResume, TailoredResumeDraft } from "./tailored-resume-schema";

const SECTION_ORDER: ResumeSection[] = ["experience", "research", "projects", "leadership", "education", "certifications", "awards", "other"];

export function createLocalTailoredDraft(resume: ResumeProfile, job: JobProfile, analysis: MatchAnalysis): TailoredResumeDraft {
  const requirementById = new Map(job.requirements.map(requirement => [requirement.id, requirement]));
  const relevance = new Map<string, { score: number; requirementIds: string[] }>();
  for (const fact of resume.facts) {
    const matches = analysis.evidenceMatches.filter(match => match.sourceFactIds.includes(fact.id));
    relevance.set(fact.id, {
      score: matches.reduce((sum, match) => sum + (match.status === "matched" ? 2 : match.status === "transferable" ? 1 : 0), 0),
      requirementIds: matches.map(match => match.requirementId),
    });
  }

  const orderedFacts = [...resume.facts].sort((a, b) => {
    const relevanceDifference = (relevance.get(b.id)?.score ?? 0) - (relevance.get(a.id)?.score ?? 0);
    if (relevanceDifference) return relevanceDifference;
    return SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  });

  const entries = orderedFacts.map((fact, entryIndex) => {
    const relevantRequirementIds = relevance.get(fact.id)?.requirementIds ?? [];
    const orderedDetails = [...fact.details].sort((a, b) => bulletRelevance(b, job) - bulletRelevance(a, job));
    return {
      sourceFactId: fact.id,
      whyIncluded: relevantRequirementIds.length
        ? `Prioritized because it supports ${relevantRequirementIds.map(id => requirementById.get(id)?.label).filter(Boolean).slice(0, 3).join(", ")}.`
        : "Retained from the confirmed master resume without adding claims.",
      bullets: orderedDetails.filter(Boolean).map((text, bulletIndex) => ({
        id: `tailored-${entryIndex + 1}-${bulletIndex + 1}`,
        text: strengthenOpening(text),
        sourceFactIds: [fact.id],
        sourceRequirementIds: relevantRequirementIds.filter(id => bulletSupportsRequirement(text, requirementById.get(id)?.label ?? "")),
        whyChanged: bulletRelevance(text, job) > 0
          ? "Moved upward to emphasize language shared with the target role; factual content remains sourced from the original bullet."
          : "Kept as supporting evidence; wording was only normalized for consistency.",
      })),
    };
  });

  const selectedSkills = [...resume.skills].sort((a, b) => Number(job.keywords.some(keyword => normalizeKeyword(keyword) === normalizeKeyword(b))) - Number(job.keywords.some(keyword => normalizeKeyword(keyword) === normalizeKeyword(a))));
  return { selectedSkills, entries, omittedFactIds: [] };
}

export function validateAndAssembleTailoredResume(resume: ResumeProfile, job: JobProfile, draft: TailoredResumeDraft, generator: "ai" | "local"): TailoredResume {
  const factById = new Map(resume.facts.map(fact => [fact.id, fact]));
  const requirementIds = new Set(job.requirements.map(requirement => requirement.id));
  const seenFacts = new Set<string>();
  const globalIssues: string[] = [];
  const entries = draft.entries.flatMap(entry => {
    const fact = factById.get(entry.sourceFactId);
    if (!fact) { globalIssues.push(`Unknown source fact: ${entry.sourceFactId}`); return []; }
    if (seenFacts.has(entry.sourceFactId)) { globalIssues.push(`Duplicate tailored entry: ${entry.sourceFactId}`); return []; }
    seenFacts.add(entry.sourceFactId);
    const bullets = entry.bullets.map(bullet => validateBullet(bullet, fact, resume, job, factById, requirementIds));
    return [{
      sourceFactId: fact.id,
      section: fact.section,
      title: fact.title,
      organization: fact.organization,
      location: fact.location,
      startDate: fact.startDate,
      endDate: fact.endDate,
      bullets,
      whyIncluded: entry.whyIncluded,
    }];
  });

  const selectedSkills = draft.selectedSkills.filter(skill => {
    const supported = resume.skills.some(source => normalizeKeyword(source) === normalizeKeyword(skill));
    if (!supported) globalIssues.push(`Unsupported skill removed: ${skill}`);
    return supported;
  });
  const bulletIssues = entries.flatMap(entry => entry.bullets.flatMap(bullet => bullet.validation.issues.map(issue => `${entry.title || entry.organization}: ${issue}`)));
  const issues = [...globalIssues, ...bulletIssues];
  return {
    name: resume.name,
    contact: resume.contact,
    summary: resume.summary,
    selectedSkills: uniqueKeywords(selectedSkills),
    entries,
    omittedFactIds: resume.facts.map(fact => fact.id).filter(id => !seenFacts.has(id)),
    validation: { valid: issues.length === 0, issues, checkedBullets: entries.reduce((sum, entry) => sum + entry.bullets.length, 0) },
    generator,
  };
}

function validateBullet(bullet: TailoredResumeDraft["entries"][number]["bullets"][number], entryFact: ResumeFact, resume: ResumeProfile, job: JobProfile, factById: Map<string, ResumeFact>, requirementIds: Set<string>): TailoredBullet {
  const issues: string[] = [];
  const validSourceIds = bullet.sourceFactIds.filter(id => factById.has(id));
  if (!validSourceIds.length) issues.push("No valid confirmed source fact is cited.");
  if (!validSourceIds.includes(entryFact.id)) issues.push(`Bullet does not cite its parent source fact ${entryFact.id}.`);
  const invalidRequirements = bullet.sourceRequirementIds.filter(id => !requirementIds.has(id));
  if (invalidRequirements.length) issues.push(`Unknown requirement citations: ${invalidRequirements.join(", ")}.`);

  const citedCorpus = validSourceIds.map(id => factById.get(id)).filter(Boolean).map(fact => factCorpus(fact!)).join(" ");
  for (const metric of extractMetrics(bullet.text)) {
    if (!normalizedIncludes(citedCorpus, metric)) issues.push(`Unsupported metric or number “${metric}”.`);
  }
  const protectedTerms = uniqueKeywords([...job.requiredSkills, ...job.preferredSkills, ...job.tools]);
  for (const term of protectedTerms) {
    if (corpusContains(bullet.text, term) && !corpusContains(citedCorpus, term)) issues.push(`“${term}” appears in the bullet but not in its cited evidence.`);
  }
  if (job.company && corpusContains(bullet.text, job.company) && !corpusContains(citedCorpus, job.company)) issues.push(`Target company “${job.company}” is not part of the cited experience.`);
  for (const entity of extractNamedEntities(bullet.text)) {
    if (!normalizedIncludes(citedCorpus, entity) && !protectedTerms.some(term => normalizeKeyword(term) === normalizeKeyword(entity))) issues.push(`Potential unsupported named entity “${entity}”.`);
  }

  return {
    ...bullet,
    sourceFactIds: validSourceIds,
    sourceRequirementIds: bullet.sourceRequirementIds.filter(id => requirementIds.has(id)),
    validation: { status: issues.length ? "flagged" : "valid", issues },
  };
}

function bulletRelevance(text: string, job: JobProfile) { return job.keywords.filter(keyword => corpusContains(text, keyword)).length; }
function bulletSupportsRequirement(text: string, requirement: string) { return Boolean(requirement && (corpusContains(text, requirement) || tokenOverlap(text, requirement) >= .25)); }
function strengthenOpening(text: string) { return text.trim().replace(/^responsible for\s+/i, "Delivered ").replace(/^helped (?:to )?/i, "Supported "); }
function factCorpus(fact: ResumeFact) { return [fact.title, fact.organization, fact.location, fact.startDate, fact.endDate, ...fact.details, ...fact.keywords].join(" "); }
function extractMetrics(text: string) { return text.match(/(?:[$~≈])?\b\d+(?:\.\d+)?(?:%|x|\+|\/\d+(?:\.\d+)?)?/gi) ?? []; }
function extractNamedEntities(text: string) {
  const candidates = text.match(/\b(?:[A-Z][a-z]{2,}(?:\s+(?:[A-Z][A-Za-z&.-]+|of|and|the)){0,4})\b/g) ?? [];
  return uniqueKeywords(candidates.filter(candidate => text.indexOf(candidate) > 0 && !COMMON_CAPITALIZED.has(candidate)));
}
function normalizedIncludes(corpus: string, value: string) { return normalizeKeyword(corpus).includes(normalizeKeyword(value)); }
function tokenOverlap(a: string, b: string) { const left = new Set(normalizeKeyword(a).split(/\s+/).filter(token => token.length > 3)); const right = normalizeKeyword(b).split(/\s+/).filter(token => token.length > 3); return right.length ? right.filter(token => left.has(token)).length / right.length : 0; }
const COMMON_CAPITALIZED = new Set(["Built", "Developed", "Designed", "Implemented", "Led", "Created", "Managed", "Improved", "Deployed", "Delivered", "Supported", "Collaborated", "Analyzed", "Maintained"]);
