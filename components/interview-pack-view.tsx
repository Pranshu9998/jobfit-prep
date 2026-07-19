"use client";

import { useState } from "react";
import type { InterviewPack, InterviewQuestion } from "../lib/interview-schema";
import type { JobProfile } from "../lib/job-schema";
import type { TailoredResume } from "../lib/tailored-resume-schema";

export function InterviewPackView({ pack, job, resume, onBack }: { pack: InterviewPack; job: JobProfile; resume: TailoredResume; onBack: () => void }) {
  const [copyState, setCopyState] = useState("");
  const [exporting, setExporting] = useState<"resume" | "prep" | null>(null);
  const [exportError, setExportError] = useState("");
  const groups = (["technical", "resume", "behavioral"] as const).map(type => [type, pack.questions.filter(question => question.type === type)] as const);

  async function copy(value: string, key: string) { await navigator.clipboard.writeText(value); setCopyState(key); window.setTimeout(() => setCopyState(""), 1600); }
  async function download(kind: "resume" | "prep") {
    setExporting(kind); setExportError("");
    try {
      const { createInterviewPdfBlob, createResumePdfBlob } = await import("../lib/pdf-download");
      const blob = kind === "resume" ? await createResumePdfBlob(resume, job) : await createInterviewPdfBlob(pack, job, resume.name);
      const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = kind === "resume" ? `${fileName(resume.name)}-${fileName(job.title)}-resume.pdf` : `${fileName(resume.name)}-${fileName(job.title)}-interview-prep.pdf`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : "The PDF could not be created."); }
    finally { setExporting(null); }
  }

  return <section className="interview-layout" aria-labelledby="interview-title">
    <article className="interview-report">
      <header className="interview-heading"><div><p>Interview prep pack</p><h1 id="interview-title">Know the role. <em>Own your evidence.</em></h1></div><span>{pack.questions.length} targeted questions</span></header>
      <p className="interview-intro">Each prompt shows why it is likely, what triggered it, and a preparation outline. The pack avoids scripted answers so your response stays truthful and natural.</p>

      <section className="prep-sheet"><header><div><span>One-page brief</span><h2>Your interview desk sheet</h2></div><button type="button" onClick={() => void copy(prepText(pack), "prep")}>{copyState === "prep" ? "Copied ✓" : "Copy sheet"}</button></header><div className="opening-pitch"><span>Opening pitch</span><p>{pack.prepSheet.openingPitch}</p></div><div className="prep-grid"><PrepList title="Priority skills" items={pack.prepSheet.prioritySkills} tone="green" /><PrepList title="Strongest stories" items={pack.prepSheet.strongestStories} tone="violet" /><PrepList title="Technical topics" items={pack.prepSheet.likelyTechnicalTopics} tone="violet" /><PrepList title="Gaps to handle honestly" items={pack.prepSheet.honestGaps} tone="amber" /></div><PrepList title="Behavioral stories" items={pack.prepSheet.behavioralStories} tone="paper" /></section>

      {groups.map(([type, questions]) => <section className="question-group" key={type}><header><div><span>{type}</span><h2>{groupTitle(type)}</h2></div><b>{questions.length} prompts</b></header><div className="question-list">{questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} copied={copyState === question.id} onCopy={() => void copy(questionText(question), question.id)} />)}</div></section>)}

      {exportError && <p className="form-error" role="alert">{exportError}</p>}
      <footer className="interview-actions"><button className="back-button" type="button" onClick={onBack}>← Edit tailored resume</button><div><button className="secondary-button" type="button" disabled={Boolean(exporting)} onClick={() => void download("resume")}>{exporting === "resume" ? "Building resume…" : "Download resume PDF"}</button><button className="primary-button" type="button" disabled={Boolean(exporting)} onClick={() => void download("prep")}>{exporting === "prep" ? "Building prep pack…" : "Download interview PDF"} <b>↓</b></button></div></footer>
    </article>
    <aside className="interview-note"><span>Pack status</span><strong>{pack.generator === "ai" ? "AI-grounded questions" : "Local grounded questions"}</strong><p>{pack.questions.filter(question => question.tag === "both").length} prompts connect the job and your resume.</p><hr /><div className="tag-key"><span><b>Resume</b>Triggered by your evidence</span><span><b>Job</b>Triggered by the posting</span><span><b>Both</b>Connects evidence to a requirement</span></div><hr /><p>Exports use the latest edited resume content and default to US Letter.</p></aside>
  </section>;
}

function QuestionCard({ question, index, copied, onCopy }: { question: InterviewQuestion; index: number; copied: boolean; onCopy: () => void }) { return <article className="question-card"><div className="question-index">{String(index + 1).padStart(2, "0")}</div><div><div className="question-meta"><span className={`source-tag ${question.tag}`}>{question.tag}</span><button type="button" onClick={onCopy}>{copied ? "Copied ✓" : "Copy"}</button></div><h3>{question.question}</h3><p className="why-likely"><b>Why likely</b>{question.whyLikely}</p><div className="trigger-box"><span>Evidence trigger</span>{question.evidence.map(item => <p key={item}>{item}</p>)}</div><details><summary>Preparation outline</summary><ol>{question.preparationOutline.map(item => <li key={item}>{item}</li>)}</ol></details></div></article>; }
function PrepList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "violet" | "amber" | "paper" }) { return <section className={`prep-list ${tone}`}><h3>{title}</h3><ul>{(items.length ? items : ["No items detected"]).map(item => <li key={item}>{item}</li>)}</ul></section>; }
function groupTitle(type: "technical" | "resume" | "behavioral") { return type === "technical" ? "Technical depth" : type === "resume" ? "Your experience under pressure" : "Behavioral stories"; }
function questionText(question: InterviewQuestion) { return `${question.question}\n\nWhy likely: ${question.whyLikely}\nEvidence: ${question.evidence.join("; ")}\nPreparation:\n${question.preparationOutline.map(item => `- ${item}`).join("\n")}`; }
function prepText(pack: InterviewPack) { const prep = pack.prepSheet; return `OPENING PITCH\n${prep.openingPitch}\n\nPRIORITY SKILLS\n${prep.prioritySkills.join("\n")}\n\nSTRONGEST STORIES\n${prep.strongestStories.join("\n")}\n\nTECHNICAL TOPICS\n${prep.likelyTechnicalTopics.join("\n")}\n\nHONEST GAPS\n${prep.honestGaps.join("\n")}\n\nBEHAVIORAL STORIES\n${prep.behavioralStories.join("\n")}`; }
function fileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "jobfit"; }
