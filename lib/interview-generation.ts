import type { MatchAnalysis } from "./analysis-schema";
import type { InterviewPack, InterviewQuestion } from "./interview-schema";
import type { JobProfile, JobRequirement } from "./job-schema";
import type { ResumeFact, ResumeProfile } from "./resume-schema";

export function createLocalInterviewPack(resume: ResumeProfile, job: JobProfile, analysis: MatchAnalysis): InterviewPack {
  const factById = new Map(resume.facts.map(fact => [fact.id, fact]));
  const matched = analysis.evidenceMatches.filter(match => match.status !== "gap");
  const technicalRequirements = job.requirements.filter(requirement => ["required_skill", "preferred_skill", "tool"].includes(requirement.kind)).slice(0, 6);
  const technical = technicalRequirements.map((requirement, index): InterviewQuestion => {
    const match = analysis.evidenceMatches.find(item => item.requirementId === requirement.id);
    const facts = (match?.sourceFactIds ?? []).map(id => factById.get(id)).filter(Boolean) as ResumeFact[];
    return {
      id: `question-technical-${index + 1}`,
      type: "technical",
      tag: facts.length ? "both" : "job",
      question: technicalQuestion(requirement),
      whyLikely: `${requirement.priority === "required" ? "Required" : "Preferred"} posting language explicitly mentions ${requirement.label}.`,
      sourceFactIds: facts.map(fact => fact.id),
      sourceRequirementIds: [requirement.id],
      evidence: facts.length ? facts.map(factLabel) : [`Job requirement: ${requirement.label}`],
      preparationOutline: technicalOutline(requirement.label, facts[0]),
    };
  });

  const rankedFactIds = Array.from(new Set([...matched.flatMap(match => match.sourceFactIds), ...resume.facts.map(fact => fact.id)])).slice(0, 5);
  const resumeQuestions = rankedFactIds.map((id, index): InterviewQuestion => {
    const fact = factById.get(id)!;
    const linkedRequirements = matched.filter(match => match.sourceFactIds.includes(id)).map(match => match.requirementId);
    return {
      id: `question-resume-${index + 1}`,
      type: "resume",
      tag: linkedRequirements.length ? "both" : "resume",
      question: `Walk me through your work as ${fact.title || `part of ${fact.organization}`}. What did you personally own, and what was the hardest decision?`,
      whyLikely: linkedRequirements.length ? "This is prominent resume evidence connected to the target role." : "Interviewers commonly probe a concrete experience listed on the resume.",
      sourceFactIds: [fact.id],
      sourceRequirementIds: linkedRequirements,
      evidence: [factLabel(fact), ...fact.details.slice(0, 1)],
      preparationOutline: ["State the goal and your exact ownership.", "Explain one technical or execution decision and its tradeoff.", "Use only the outcome or metric already supported by the resume.", "Close with what you learned or would improve."],
    };
  });

  const behavioralFacts = [...resume.facts].filter(fact => ["leadership", "experience", "research", "projects"].includes(fact.section)).slice(0, 4);
  const behavioralPrompts = [
    "Tell me about a time you led through ambiguity or competing priorities.",
    "Describe a difficult technical problem you debugged. How did you isolate the cause?",
    "Tell me about a disagreement with a teammate and how you handled it.",
    "Describe a time you learned a new tool or concept quickly to deliver a result.",
  ];
  const behavioral = behavioralPrompts.map((question, index): InterviewQuestion => {
    const fact = behavioralFacts[index % Math.max(behavioralFacts.length, 1)];
    return {
      id: `question-behavioral-${index + 1}`,
      type: "behavioral",
      tag: fact ? "both" : "job",
      question,
      whyLikely: job.softSkills.length ? `The posting emphasizes ${job.softSkills.slice(0, 2).join(" and ")}.` : "This tests ownership, communication, and reflection for the role.",
      sourceFactIds: fact ? [fact.id] : [],
      sourceRequirementIds: job.requirements.filter(requirement => requirement.kind === "soft_skill").slice(0, 2).map(requirement => requirement.id),
      evidence: fact ? [factLabel(fact)] : ["Job behavioral expectations"],
      preparationOutline: fact ? [`Situation: establish the context at ${fact.organization || fact.title}.`, "Task: define your responsibility and the constraint.", "Action: emphasize your decisions, communication, and tradeoffs.", "Result: use a supported result, then reflect on what changed afterward."] : ["Choose one confirmed resume story.", "Structure it with Situation, Task, Action, and Result.", "Keep the answer under two minutes.", "End with a specific lesson."],
    };
  });

  const strongestFacts = rankedFactIds.map(id => factById.get(id)).filter(Boolean).slice(0, 4) as ResumeFact[];
  const honestGaps = analysis.evidenceMatches.filter(match => match.status === "gap").map(match => match.requirement).slice(0, 6);
  return {
    generator: "local",
    questions: [...technical, ...resumeQuestions, ...behavioral],
    prepSheet: {
      prioritySkills: [...job.requiredSkills, ...analysis.matchedKeywords].filter(unique).slice(0, 7),
      strongestStories: strongestFacts.map(factLabel),
      likelyTechnicalTopics: technicalRequirements.map(requirement => requirement.label),
      honestGaps,
      behavioralStories: behavioralFacts.map(fact => `${factLabel(fact)} - prepare ownership, conflict, learning, and outcome details.`),
      openingPitch: `I am ${resume.name}, and my strongest fit for the ${job.title} role is the combination of ${analysis.matchedKeywords.slice(0, 3).join(", ") || "my confirmed technical and project experience"}. I would connect those skills to ${strongestFacts[0] ? factLabel(strongestFacts[0]) : "the most relevant experience on my resume"}.`,
    },
  };
}

export function sanitizeInterviewPack(pack: InterviewPack, resume: ResumeProfile, job: JobProfile, analysis: MatchAnalysis, generator: "ai" | "local"): InterviewPack {
  const factIds = new Set(resume.facts.map(fact => fact.id));
  const requirementIds = new Set(job.requirements.map(requirement => requirement.id));
  const factById = new Map(resume.facts.map(fact => [fact.id, fact]));
  const requirementById = new Map(job.requirements.map(requirement => [requirement.id, requirement]));
  const groundedPrepSheet = createLocalInterviewPack(resume, job, analysis).prepSheet;
  return {
    ...pack,
    generator,
    prepSheet: groundedPrepSheet,
    questions: pack.questions.map((question, index) => {
      const sourceFactIds = question.sourceFactIds.filter(id => factIds.has(id));
      const sourceRequirementIds = question.sourceRequirementIds.filter(id => requirementIds.has(id));
      const facts = sourceFactIds.map(id => factById.get(id)).filter(Boolean) as ResumeFact[];
      const requirements = sourceRequirementIds.map(id => requirementById.get(id)).filter(Boolean) as JobRequirement[];
      const evidence = [
        ...facts.flatMap(fact => [factLabel(fact), ...fact.details.slice(0, 1)]),
        ...requirements.map(requirement => `Job posting: ${requirement.sourceText || requirement.label}`),
      ].filter(unique);
      return {
        ...question,
        id: question.id || `question-${question.type}-${index + 1}`,
        sourceFactIds,
        sourceRequirementIds,
        evidence: evidence.length ? evidence : ["Role-specific interview practice; no candidate claim is implied."],
        whyLikely: facts.length && requirements.length
          ? "This connects confirmed resume evidence to an explicit job requirement."
          : facts.length
            ? "Interviewers often probe this confirmed resume evidence."
            : requirements.length
              ? "The job posting explicitly includes this requirement."
              : "This is a common role-specific interview prompt and does not imply prior experience.",
        preparationOutline: groundedQuestionOutline(question.type, facts[0]),
      };
    }),
  };
}

function groundedQuestionOutline(type: InterviewQuestion["type"], fact?: ResumeFact) {
  if (type === "technical") return ["Define the concept before using jargon.", "Explain one mechanism, tradeoff, or common failure mode.", fact ? `Connect only to confirmed evidence from ${factLabel(fact)}.` : "Say clearly when your knowledge is conceptual rather than hands-on.", "Close with how you would test or validate the result."];
  if (type === "behavioral") return [fact ? `Use ${factLabel(fact)} only if it genuinely fits the prompt.` : "Choose a confirmed resume story that genuinely fits.", "State the situation and your exact responsibility.", "Describe your actions without adding unsupported people, constraints, or outcomes.", "Use only a confirmed result, then state what you learned."];
  return [fact ? `Set the context for ${factLabel(fact)}.` : "Choose one confirmed resume entry.", "Separate your personal contribution from the team's work.", "Use only tools, decisions, and metrics present in confirmed evidence.", "End with an honest lesson or improvement you can explain naturally."];
}

function technicalQuestion(requirement: JobRequirement) {
  if (/react/i.test(requirement.label)) return "How does React decide when to re-render a component, and how would you diagnose an unnecessary render?";
  if (/javascript|typescript/i.test(requirement.label)) return `Explain one important ${requirement.label} language behavior that has affected code you shipped.`;
  if (/aws|cloud/i.test(requirement.label)) return "How would you design and debug a reliable deployment on AWS? Walk through the failure points you would check.";
  if (/docker/i.test(requirement.label)) return "What problem does Docker solve, and how would you make a containerized development and production environment consistent?";
  if (/verilog|systemverilog/i.test(requirement.label)) return `Explain blocking versus non-blocking assignments and how that choice affects ${requirement.label} simulation behavior.`;
  if (/uvm/i.test(requirement.label)) return "What are the major components of a UVM testbench, and how does a transaction move through them?";
  return `Explain the core concepts behind ${requirement.label}, then describe how you would apply them to a real engineering task.`;
}
function technicalOutline(label: string, fact?: ResumeFact) { return [`Define ${label} clearly before using jargon.`, "Explain one mechanism, tradeoff, or common failure mode.", fact ? `Ground the answer in ${factLabel(fact)} without overstating your role.` : "Be explicit that your experience is conceptual if it is not shown on the resume.", "End with how you would test or validate the result."]; }
function factLabel(fact: ResumeFact) { return [fact.title, fact.organization].filter(Boolean).join(" - "); }
function unique(value: string, index: number, values: string[]) { return values.indexOf(value) === index; }
