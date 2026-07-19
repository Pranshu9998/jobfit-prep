import { mkdir } from "node:fs/promises";
import { renderToFile } from "@react-pdf/renderer";
import { InterviewPrepPdfDocument, ResumePdfDocument } from "../components/pdf-documents";
import { createLocalInterviewPack } from "../lib/interview-generation";
import { createLocalJobProfile } from "../lib/local-job-parser";
import { createLocalResumeDraft } from "../lib/local-resume-parser";
import { assembleAnalysis, createLocalSemanticEvaluation } from "../lib/match-analysis";
import { createLocalTailoredDraft, validateAndAssembleTailoredResume } from "../lib/resume-tailoring";

const resume = createLocalResumeDraft(`
Jordan Lee
jordan.lee@example.com | (512) 555-0199 | github.com/jordanlee
Education
State University, Austin, TX
Bachelor of Science in Computer Engineering | May 2027
Skills
Languages: Python, JavaScript, TypeScript, C++
Tools: React.js, Node.js, Docker, AWS, Git, Linux
Technical Experience
Software Engineering Intern — Example Systems LLC
May 2025 – Aug 2025
– Built a React.js operations dashboard and Node.js REST APIs used by internal engineering teams.
– Containerized the service with Docker and deployed it on AWS, improving release speed by 25%.
– Debugged production data issues and added validation, tests, and clearer error handling.
Research
Undergraduate Researcher — State University
Jan 2025 – Present
– Developed Python tooling to analyze streaming model behavior and documented experiment results.
Projects
RISC-V Pipeline Visualizer
Aug 2024 – Dec 2024
– Designed an interactive five-stage pipeline simulator with hazard detection and forwarding controls.
Leadership & Service
Robotics Team — Hardware Lead
Aug 2023 – Present
– Led a six-person build team, coordinated testing, and presented design tradeoffs before competitions.
`, "jordan-resume.pdf");
const job = createLocalJobProfile({ company: "Northstar Computing", title: "Software Engineering Intern", url: "", description: `
Responsibilities
• Build and maintain React applications and REST APIs for engineering workflows.
• Collaborate with engineers to test and deploy reliable cloud services.
• Debug production issues and communicate technical tradeoffs.
Required Qualifications
• Proficiency with JavaScript or TypeScript, React, Git, and data structures.
• Experience with AWS and REST APIs.
Preferred Qualifications
• Familiarity with Docker, Python, Linux, and distributed systems.
• Strong collaboration, communication, and problem solving skills.
` });
const analysis = assembleAnalysis(resume, job, createLocalSemanticEvaluation(resume, job), "deterministic-local");
const tailored = validateAndAssembleTailoredResume(resume, job, createLocalTailoredDraft(resume, job, analysis), "local");
const pack = createLocalInterviewPack(resume, job, analysis);
const output = new URL("../tmp/pdfs/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
await renderToFile(<ResumePdfDocument resume={tailored} job={job} />, `${output}/jobfit-resume-fixture.pdf`);
await renderToFile(<InterviewPrepPdfDocument pack={pack} job={job} candidateName={resume.name} />, `${output}/jobfit-interview-fixture.pdf`);

