import type { JobProfile, JobRequirement } from "./job-schema";
import { normalizeKeyword, uniqueKeywords } from "./keyword-normalization";

const TECH_TERMS = [
  "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "React", "React.js", "Node.js", "Next.js", "HTML", "CSS",
  "SQL", "PostgreSQL", "Firebase", "Git", "Linux", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "REST APIs", "GraphQL",
  "LLM", "machine learning", "AI", "PyTorch", "TensorFlow", "NLP", "data structures", "algorithms", "distributed systems",
  "Verilog", "SystemVerilog", "UVM", "FPGA", "RISC-V", "digital logic", "computer architecture", "embedded systems", "Qiskit", "CAD",
  "CI/CD", "Agile", "unit testing", "debugging", "cloud computing", "microservices",
];
const SOFT_TERMS = ["communication", "collaboration", "leadership", "teamwork", "problem solving", "ownership", "attention to detail", "time management", "adaptability", "initiative"];
const SECTION_REQUIRED = /^(required|required qualifications|minimum qualifications|qualifications|what you need|basic qualifications)/i;
const SECTION_PREFERRED = /^(preferred|preferred qualifications|nice to have|bonus|desired qualifications)/i;
const SECTION_RESPONSIBILITIES = /^(responsibilities|what you.ll do|the role|job duties|duties|about the role)/i;

export function createLocalJobProfile(input: { company: string; title: string; url: string; description: string }): JobProfile {
  const lines = input.description.split(/\r?\n/).map(line => line.replace(/^[•●▪◦‣·*\-–—]\s*/, "").trim()).filter(Boolean);
  let context: "required" | "preferred" | "responsibility" | "context" = "context";
  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const responsibilities: string[] = [];
  const experienceExpectations: string[] = [];
  const requirements: JobRequirement[] = [];

  for (const line of lines) {
    if (line.length < 70 && SECTION_REQUIRED.test(line.replace(/:$/, ""))) { context = "required"; continue; }
    if (line.length < 70 && SECTION_PREFERRED.test(line.replace(/:$/, ""))) { context = "preferred"; continue; }
    if (line.length < 70 && SECTION_RESPONSIBILITIES.test(line.replace(/:$/, ""))) { context = "responsibility"; continue; }

    const lower = line.toLowerCase();
    const explicitPreferred = /preferred|nice to have|bonus|ideally|a plus/.test(lower);
    const explicitRequired = /required|must have|must be|minimum|proficien|strong (?:knowledge|understanding|experience)/.test(lower);
    const lineContext = explicitPreferred ? "preferred" : explicitRequired ? "required" : context;
    const foundTerms = findTerms(line, TECH_TERMS);
    for (const term of foundTerms) {
      if (lineContext === "preferred") preferredSkills.push(term);
      else if (lineContext === "required") requiredSkills.push(term);
    }

    const experience = line.match(/(?:at least\s+)?\d+(?:\s*[-–]\s*\d+)?\+?\s+years?(?:\s+of)?[^.;]*/i)?.[0];
    if (experience) experienceExpectations.push(experience.trim());
    if (context === "responsibility" || /^(build|develop|design|implement|create|lead|work|collaborate|support|analyze|maintain|write|test|debug|deliver|own|participate|contribute)/i.test(line)) responsibilities.push(line);
  }

  const allTools = findTerms(input.description, TECH_TERMS);
  const softSkills = findTerms(input.description, SOFT_TERMS);
  const required = uniqueKeywords(requiredSkills);
  const preferred = uniqueKeywords(preferredSkills.filter(skill => !required.some(value => normalizeKeyword(value) === normalizeKeyword(skill))));
  const tools = uniqueKeywords(allTools);
  const duties = uniqueText(responsibilities).slice(0, 12);
  const experience = uniqueText(experienceExpectations);

  addRequirements(requirements, required, "required_skill", "required");
  addRequirements(requirements, preferred, "preferred_skill", "preferred");
  addRequirements(requirements, duties, "responsibility", "context");
  addRequirements(requirements, experience, "experience", "required");
  addRequirements(requirements, softSkills, "soft_skill", "context");

  const unclassifiedTools = tools.filter(tool => ![...required, ...preferred].some(skill => normalizeKeyword(skill) === normalizeKeyword(tool)));
  addRequirements(requirements, unclassifiedTools, "tool", "context");
  const keywords = uniqueKeywords([...required, ...preferred, ...tools, ...softSkills]);

  return {
    ...input,
    requiredSkills: required,
    preferredSkills: preferred,
    responsibilities: duties,
    tools,
    softSkills,
    experienceExpectations: experience,
    keywords,
    requirements,
    parser: "local",
  };
}

function findTerms(text: string, terms: string[]) {
  return terms.filter(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, "i").test(text);
  });
}

function addRequirements(target: JobRequirement[], values: string[], kind: JobRequirement["kind"], priority: JobRequirement["priority"]) {
  values.forEach(value => target.push({ id: `req-${kind}-${target.length + 1}`, kind, label: value, sourceText: value, priority }));
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}
