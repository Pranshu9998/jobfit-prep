import type { ResumeFact, ResumeProfile, ResumeSection } from "./resume-schema";

type ParsedSection = ResumeSection | "skills" | "summary";
type EntryDraft = { header: string[]; bullets: string[] };

const SECTION_PATTERNS: Array<[RegExp, ParsedSection]> = [
  [/^(education|academic background|academics|qualifications)$/i, "education"],
  [/^(experience|technical experience|work experience|employment|professional experience|industry experience|work & leadership experience)$/i, "experience"],
  [/^(projects|technical projects|selected projects|academic projects|personal projects)$/i, "projects"],
  [/^(research|research experience|publications)$/i, "research"],
  [/^(leadership|leadership & service|leadership and service|leadership experience|activities|involvement|volunteering|campus involvement|extracurriculars)$/i, "leadership"],
  [/^(awards|honors|honors & awards|achievements)$/i, "awards"],
  [/^(certifications|licenses|licenses & certifications|awards & certifications)$/i, "certifications"],
  [/^(skills|technical skills|technologies|tools|skills & interests|technical proficiencies)$/i, "skills"],
  [/^(summary|profile|professional summary|objective)$/i, "summary"],
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]\d{4}/g;
const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/\S+|github\.com\/\S+|[\w.-]+\.(?:com|dev|io|me|net|org)\/\S*)/gi;
const DATE_TOKEN = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Spring|Summer|Fall|Winter)";
const DATE_RANGE_PATTERN = new RegExp(`(?:${DATE_TOKEN}\\s+)?(?:19|20)\\d{2}\\s*(?:[-–—]|to)\\s*(?:(?:${DATE_TOKEN})\\s+)?(?:(?:19|20)\\d{2}|Present|Current)|${DATE_TOKEN}\\s+(?:19|20)\\d{2}\\s*(?:[-–—]|to)\\s*(?:${DATE_TOKEN}\\s+)?(?:(?:19|20)\\d{2}|Present|Current)|(?:Expected\\s+)?${DATE_TOKEN}?\\s*(?:19|20)\\d{2}`, "i");
const ROLE_PATTERN = /\b(intern|engineer|developer|researcher|research assistant|teaching assistant|instructor|teacher|analyst|designer|technician|consultant|manager|lead|president|treasurer|officer|founder|fellow|tutor|mentor|coordinator|specialist|associate|assistant|director|architect)\b/i;
const ORG_PATTERN = /\b(university|college|school|institute|laboratory|labs?|inc\.?|llc|ltd\.?|corp\.?|corporation|company|systems|technologies|solutions|group|team|club|association|foundation|real estate)\b/i;
const DEGREE_PATTERN = /\b(bachelor|master|doctor|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?a\.?|degree|major|minor)\b/i;
const LOCATION_PATTERN = /\b(?:Remote|[A-Z][A-Za-z.' -]+,\s*[A-Z]{2})\b/;
const ACTION_PATTERN = /^(built|developed|designed|implemented|led|created|analyzed|improved|managed|engineered|programmed|optimized|tested|debugged|automated|collaborated|conducted|delivered|deployed|maintained|modeled|presented|researched|supported|trained|utilized|wrote|achieved|reduced|increased)\b/i;
const BULLET_PATTERN = /^[•●▪◦‣·*\-–—]\s*/;

export function createLocalResumeDraft(sourceText: string, sourceName: string): ResumeProfile {
  const lines = normalizeLines(sourceText);
  const firstSectionIndex = lines.findIndex(line => Boolean(detectSection(line)));
  const headerLines = lines.slice(0, firstSectionIndex >= 0 ? firstSectionIndex : Math.min(lines.length, 8));
  const contact = extractContacts(headerLines.join("\n"));
  const name = detectName(headerLines, contact);
  const sections = collectSections(lines, firstSectionIndex);
  const skills = parseSkills(sections.get("skills") ?? []);
  const summary = (sections.get("summary") ?? []).join(" ");
  const facts: ResumeFact[] = [];

  for (const section of ["education", "experience", "research", "projects", "leadership", "awards", "certifications", "other"] as ResumeSection[]) {
    const sectionLines = sections.get(section) ?? [];
    if (section === "education") {
      parseEducation(sectionLines).forEach((fact, index) => facts.push({ ...fact, id: `fact-education-${index + 1}` }));
    } else if (section === "certifications" || section === "awards") {
      parseCredentials(sectionLines).forEach((entry, index) => facts.push(toResumeFact(entry, section, index)));
    } else {
      parseEntries(sectionLines).forEach((entry, index) => facts.push(toResumeFact(entry, section, index)));
    }
  }

  if (!facts.length) {
    const content = lines.filter(line => !headerLines.includes(line));
    facts.push(toResumeFact({ header: content.slice(0, 2), bullets: content.slice(2) }, "other", 0));
  }

  const keywords = Array.from(new Set([...skills, ...facts.flatMap(fact => fact.keywords)])).slice(0, 40);
  return { name, contact, summary, skills, keywords, facts, sourceText, sourceName, parser: "local" };
}

export function detectSection(line: string): ParsedSection | null {
  const normalized = line.replace(/[|:]/g, " ").replace(/\s+/g, " ").trim();
  const exact = SECTION_PATTERNS.find(([pattern]) => pattern.test(normalized));
  if (exact) return exact[1];
  if (normalized.length <= 38 && normalized === normalized.toUpperCase()) {
    const fuzzy = SECTION_PATTERNS.find(([pattern]) => pattern.test(toTitleCase(normalized)));
    return fuzzy?.[1] ?? null;
  }
  return null;
}

function normalizeLines(text: string) {
  return text.replace(/\u0000/g, "").split(/\r?\n/).map(line => line.replace(/\s{2,}/g, "   ").trim()).filter(Boolean);
}

function collectSections(lines: string[], firstSectionIndex: number) {
  const sections = new Map<ParsedSection, string[]>();
  let current: ParsedSection = "other";
  const start = firstSectionIndex >= 0 ? firstSectionIndex : Math.min(lines.length, 8);
  for (const line of lines.slice(start)) {
    const section = detectSection(line);
    if (section) { current = section; continue; }
    sections.set(current, [...(sections.get(current) ?? []), line]);
  }
  return sections;
}

function extractContacts(text: string) {
  const values = [...(text.match(EMAIL_PATTERN) ?? []), ...(text.match(PHONE_PATTERN) ?? []), ...(text.match(URL_PATTERN) ?? [])];
  return Array.from(new Set(values.map(value => value.replace(/[|,;]+$/, "").trim())));
}

function detectName(lines: string[], contacts: string[]) {
  const candidates = lines.map(line => {
    let cleaned = line;
    contacts.forEach(contact => { cleaned = cleaned.replace(contact, " "); });
    return cleaned.replace(/[|•·]+/g, " ").replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  return candidates.find(candidate => {
    const words = candidate.split(/\s+/);
    return words.length >= 2 && words.length <= 5 && words.every(word => /^[A-Za-zÀ-ÖØ-öø-ÿ.'-]+$/.test(word));
  }) ?? candidates[0] ?? "";
}

function parseSkills(lines: string[]) {
  return Array.from(new Set(lines.flatMap(line => {
    const value = line.replace(/^[A-Za-z /&+#.-]{2,28}:\s*/, "");
    return value.split(/[,|;•]+/).map(item => item.trim()).filter(item => item.length > 1);
  })));
}

function parseEntries(lines: string[]): EntryDraft[] {
  const entries: EntryDraft[] = [];
  let current: EntryDraft = { header: [], bullets: [] };
  const flush = () => {
    if (current.header.length || current.bullets.length) entries.push(current);
    current = { header: [], bullets: [] };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const explicitBullet = BULLET_PATTERN.test(line);
    const clean = line.replace(BULLET_PATTERN, "").trim();
    const looksLikeBullet = explicitBullet || ACTION_PATTERN.test(clean);

    if (looksLikeBullet) {
      current.bullets.push(clean);
      continue;
    }

    if (current.bullets.length) {
      if (looksLikeHeader(line)) {
        flush();
        current.header.push(line);
      } else {
        current.bullets[current.bullets.length - 1] = appendWrappedText(
          current.bullets[current.bullets.length - 1],
          line,
        );
      }
      continue;
    }

    current.header.push(line);
  }
  flush();
  return entries.filter(entry => entry.header.some(Boolean) || entry.bullets.some(Boolean));
}

function parseEducation(lines: string[]): Array<Omit<ResumeFact, "id">> {
  if (!lines.length) return [];
  const entries: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (current.length && /\b(university|college|school|institute)\b/i.test(line)) {
      entries.push(current);
      current = [line];
    } else current.push(line);
  }
  if (current.length) entries.push(current);

  return entries.map(entry => {
    const location = entry.join(" ").match(LOCATION_PATTERN)?.[0] ?? "";
    const organization = cleanPart(entry[0].replace(location, ""));
    const titleLine = entry.slice(1).find(line => DEGREE_PATTERN.test(line) || /^Class of\b/i.test(line)) ?? entry[1] ?? "";
    const graduationYear = titleLine.match(/(?:19|20)\d{2}/)?.[0] ?? "";
    const details = entry.slice(1).filter(line => line !== titleLine);
    return { section: "education" as const, title: titleLine, organization, location, startDate: "", endDate: graduationYear, details, keywords: extractKeywords(entry.join(" ")) };
  });
}

function parseCredentials(lines: string[]): EntryDraft[] {
  return lines.map(line => ({ header: [line.replace(BULLET_PATTERN, "").trim()], bullets: [] })).filter(entry => entry.header[0]);
}

function looksLikeHeader(line: string) {
  const wordCount = line.split(/\s+/).length;
  return Boolean(DATE_RANGE_PATTERN.test(line) || ROLE_PATTERN.test(line) || ORG_PATTERN.test(line) || DEGREE_PATTERN.test(line) || (wordCount <= 10 && !/[.!?]$/.test(line)));
}

function toResumeFact(entry: EntryDraft, section: ResumeSection, index: number): ResumeFact {
  const header = entry.header.join(" | ").replace(/[ \t]+/g, " ").trim();
  const date = header.match(DATE_RANGE_PATTERN)?.[0] ?? "";
  const location = header.match(LOCATION_PATTERN)?.[0] ?? "";
  const cleanedHeader = header.replace(date, " ").replace(location, " ").replace(/\s+[—–-]\s+/g, " | ").replace(/\s*[|•·]\s*/g, " | ").replace(/\s+/g, " ").trim();
  const parts = cleanedHeader.split(/\s+\|\s+|\s+at\s+|\s{3,}/i).map(part => part.trim()).filter(Boolean);
  const { title, organization } = classifyHeader(parts.length ? parts : entry.header, section);
  const keywords = extractKeywords(`${title} ${organization} ${entry.bullets.join(" ")}`);

  return {
    id: `fact-${section}-${index + 1}`,
    section,
    title,
    organization,
    location,
    startDate: splitDate(date)[0],
    endDate: splitDate(date)[1],
    details: entry.bullets,
    keywords,
  };
}

function classifyHeader(rawParts: string[], section: ResumeSection) {
  const parts = rawParts.map(part => cleanPart(part.replace(DATE_RANGE_PATTERN, "").replace(LOCATION_PATTERN, ""))).filter(Boolean);
  if (!parts.length) return { title: "", organization: "" };
  if (section === "projects" || section === "awards" || section === "certifications") return { title: parts[0], organization: parts.slice(1).join(" · ") };

  const collaboration = parts[0].match(/^(.*?)\s*\((?:w\/|with)\s+(.+?)\)$/i);
  if (collaboration) return { title: collaboration[1].trim(), organization: collaboration[2].trim() };

  const roleIndex = parts.findIndex(part => ROLE_PATTERN.test(part) || (section === "education" && DEGREE_PATTERN.test(part)));
  const organizationIndex = parts.findIndex((part, index) => index !== roleIndex && ORG_PATTERN.test(part));
  const roleParts = parts.filter(part => ROLE_PATTERN.test(part)).map(stripRoleTenure);
  const title = section === "leadership" && roleParts.length ? roleParts.join(" · ") : roleIndex >= 0 ? parts[roleIndex] : section === "education" && parts.length > 1 ? parts[1] : parts[0];
  const organization = organizationIndex >= 0 ? parts[organizationIndex] : parts.find((_, index) => index !== roleIndex) ?? "";
  return { title, organization };
}

function cleanPart(value: string) {
  return value.replace(/^[,;|\s]+|[,;|\s]+$/g, "").trim();
}

function stripRoleTenure(value: string) {
  return cleanPart(value.replace(/\(\s*\)/g, "").replace(/\(\s*(?:(?:19|20)\d{2}|[A-Z][a-z]{2,8}\s+(?:19|20)\d{2})\s*[–—-]\s*(?:(?:19|20)\d{2}|Present|Current|[A-Z][a-z]{2,8}\s+(?:19|20)\d{2})\s*\)/gi, ""));
}

function appendWrappedText(previous: string, next: string) {
  // PDF line wrapping can split a word with a literal hyphen ("communi-" +
  // "cation"). Preserve semantic hyphens, but heal this common lowercase wrap.
  if (previous.endsWith("-") && /^[a-z]/.test(next)) return `${previous.slice(0, -1)}${next}`;
  return `${previous} ${next}`;
}

function splitDate(value: string): [string, string] {
  if (!value) return ["", ""];
  const parts = value.split(/\s*(?:[-–—]|to)\s*/i);
  return parts.length > 1 ? [parts[0].trim(), parts.slice(1).join(" ").trim()] : ["", value.trim()];
}

function extractKeywords(text: string) {
  const matches = text.match(/\b(?:Python|Java|C\+\+|C#|React|Next\.js|TypeScript|JavaScript|Verilog|SystemVerilog|UVM|FPGA|RISC-V|Linux|Git|MATLAB|SQL|AWS|Docker|Kubernetes|PyTorch|TensorFlow|XGBoost|Cadence|Vivado|Quartus)\b/gi) ?? [];
  return Array.from(new Set(matches.map(match => match.trim())));
}

function toTitleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}
