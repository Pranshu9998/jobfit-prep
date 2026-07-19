import assert from "node:assert/strict";
import test from "node:test";
import { reconstructPdfText } from "../lib/pdf-layout";
import { createLocalResumeDraft } from "../lib/local-resume-parser";

test("reconstructs PDF fragments into coordinate-aware lines", () => {
  const text = reconstructPdfText([
    { text: "avery@example.com", x: 390, y: 742, width: 110, height: 11 },
    { text: "Avery", x: 70, y: 742, width: 34, height: 18 },
    { text: "Singh", x: 108, y: 742, width: 35, height: 18 },
    { text: "EXPERIENCE", x: 70, y: 700, width: 82, height: 12 },
    { text: "Hardware Verification Intern", x: 70, y: 678, width: 152, height: 11 },
    { text: "AMD", x: 240, y: 678, width: 25, height: 11 },
    { text: "May 2025 – Aug 2025", x: 390, y: 678, width: 115, height: 11 },
    { text: "•", x: 70, y: 658, width: 5, height: 10 },
    { text: "Built UVM testbenches", x: 82, y: 658, width: 130, height: 10 },
  ]);

  assert.match(text, /^Avery Singh\navery@example\.com/m);
  assert.match(text, /EXPERIENCE/);
  assert.match(text, /Hardware Verification Intern\s+AMD/);
  assert.match(text, /May 2025 – Aug 2025/);
  assert.match(text, /• Built UVM testbenches/);
});

test("parses identity, contacts, multiple roles, dates, locations, and bullets", () => {
  const profile = createLocalResumeDraft(`
Avery Singh
avery.singh@example.com | (317) 555-0199 | linkedin.com/in/averysingh

EDUCATION
Purdue University | West Lafayette, IN
Bachelor of Science in Computer Engineering | Expected May 2027

EXPERIENCE
Hardware Verification Intern | AMD | Austin, TX
May 2025 – Aug 2025
• Built UVM testbenches for a Verilog subsystem.
• Debugged timing failures and improved regression coverage.
Research Assistant | Purdue University | West Lafayette, IN
Jan 2024 – Present
• Developed Python tooling for FPGA power analysis.

PROJECTS
RISC-V Pipeline Simulator | TypeScript, Verilog
• Designed a five-stage pipeline visualization with hazard detection.

TECHNICAL SKILLS
Languages: Python, TypeScript, Verilog
Tools: Git, Linux, Vivado
`, "avery-resume.pdf");

  assert.equal(profile.name, "Avery Singh");
  assert.ok(profile.contact.some(value => value === "avery.singh@example.com"));
  assert.ok(profile.contact.some(value => value.includes("317")));
  assert.ok(profile.contact.some(value => value.includes("linkedin.com")));
  assert.ok(profile.skills.includes("Python"));
  assert.ok(profile.skills.includes("Vivado"));

  const experiences = profile.facts.filter(fact => fact.section === "experience");
  assert.equal(experiences.length, 2);
  assert.equal(experiences[0].title, "Hardware Verification Intern");
  assert.equal(experiences[0].organization, "AMD");
  assert.equal(experiences[0].location, "Austin, TX");
  assert.equal(experiences[0].startDate, "May 2025");
  assert.equal(experiences[0].endDate, "Aug 2025");
  assert.equal(experiences[0].details.length, 2);
  assert.equal(experiences[1].title, "Research Assistant");
  assert.equal(experiences[1].organization, "Purdue University");
  assert.equal(experiences[1].endDate, "Present");

  const project = profile.facts.find(fact => fact.section === "projects");
  assert.equal(project?.title, "RISC-V Pipeline Simulator");
  assert.match(project?.details[0] ?? "", /hazard detection/);
});

test("maps student resume sections and em-dash role/company pairs into confirmed evidence", () => {
  const profile = createLocalResumeDraft(`
Casey Student

Education
McNeil High School , Austin, TX
Class of 2026
GPA: 3.80/4 (UW)

Skills
Languages: Java, Python, JavaScript/TypeScript, C#
Frameworks/Tools: React.js, Node.js, Firebase, Docker, AWS, Git; Qiskit; CAD/3D printing

Technical Experience
Software Development Intern — All City Real Estate Ltd
Apr 2024 – Aug 2024
– Built an LLM-powered assistant for natural-language MLS search to replace
manual filter workflows.
Software Development Intern — Haritechs LLC
Apr 2025 – Aug 2025
– Built a React.js frontend and Node.js backend with Firebase.
Code Ninjas — Coding Instructor
May 2023 – Present
– Designed lesson plans and pacing guides.

Research
Independent AI Researcher (w/ UC Berkeley)
May 2025 – Present
– Developed a continual-learning method for LLMs.

Leadership & Service
McNeil HS VEX Robotics Team
Mar 2023 – Present
Co-President (Mar 2025–Present) — Hardware Lead (Mar 2024–Mar 2025) — Treasurer (Mar 2023–Mar 2024)
– Led robot design and tournament operations; managed sponsor communi-
cation.
Quantum Computing Club — Vice President & Co-Founder
Aug 2023 – Present
– Built workshops with hands-on Qiskit labs.

Certifications
– Microsoft Office Specialist (MOS): Microsoft Excel
– Autodesk Certified User (ACU): AutoCAD
– Autodesk Certified User (ACU): Inventor
`, "student-resume.pdf");

  const education = profile.facts.filter(fact => fact.section === "education");
  assert.equal(education.length, 1);
  assert.equal(education[0].organization, "McNeil High School");
  assert.equal(education[0].location, "Austin, TX");
  assert.equal(education[0].title, "Class of 2026");
  assert.deepEqual(education[0].details, ["GPA: 3.80/4 (UW)"]);

  const experiences = profile.facts.filter(fact => fact.section === "experience");
  assert.equal(experiences.length, 3);
  assert.deepEqual(
    experiences.map(({ title, organization }) => ({ title, organization })),
    [
      { title: "Software Development Intern", organization: "All City Real Estate Ltd" },
      { title: "Software Development Intern", organization: "Haritechs LLC" },
      { title: "Coding Instructor", organization: "Code Ninjas" },
    ],
  );

  const research = profile.facts.filter(fact => fact.section === "research");
  assert.equal(research.length, 1);
  assert.equal(research[0].title, "Independent AI Researcher");
  assert.equal(research[0].organization, "UC Berkeley");

  const leadership = profile.facts.filter(fact => fact.section === "leadership");
  assert.equal(leadership.length, 2);
  assert.equal(leadership[0].organization, "McNeil HS VEX Robotics Team");
  assert.match(leadership[0].title, /Co-President/);
  assert.match(leadership[0].title, /Hardware Lead/);
  assert.match(leadership[0].title, /Treasurer/);
  assert.match(leadership[0].details[0], /sponsor communication/);
  assert.equal(leadership[1].organization, "Quantum Computing Club");
  assert.match(leadership[1].title, /Vice President/);

  const certifications = profile.facts.filter(fact => fact.section === "certifications");
  assert.equal(certifications.length, 3);
  assert.equal(certifications[0].title, "Microsoft Office Specialist (MOS): Microsoft Excel");
  assert.ok(profile.skills.includes("Java"));
  assert.ok(profile.skills.includes("Qiskit"));
});
