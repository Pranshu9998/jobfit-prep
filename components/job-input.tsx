"use client";

import { useState } from "react";
import type { ResumeProfile } from "../lib/resume-schema";

export type JobInputValue = { company: string; title: string; url: string; description: string };

export function JobInput({ resume, initialValue, busy, error, onBack, onGenerate }: {
  resume: ResumeProfile;
  initialValue?: JobInputValue;
  busy: "job" | "analysis" | null;
  error: string;
  onBack: () => void;
  onGenerate: (value: JobInputValue) => void;
}) {
  const [value, setValue] = useState<JobInputValue>(initialValue ?? { company: "", title: "", url: "", description: "" });
  const update = (key: keyof JobInputValue, next: string) => setValue(current => ({ ...current, [key]: next }));
  const valid = value.company.trim() && value.title.trim() && value.description.trim().length >= 80;

  return <section className="job-layout" aria-labelledby="job-title">
    <article className="job-paper">
      <header className="job-heading"><div><p>Define the target</p><h1 id="job-title">One posting. <em>One honest comparison.</em></h1></div><span>02 / Job brief</span></header>
      <p className="job-intro">Paste the posting exactly as written. Required skills, preferred skills, responsibilities, tools, and experience expectations will be separated before scoring.</p>
      <div className="job-meta-grid">
        <label><span>Company</span><input autoComplete="organization" value={value.company} onChange={event => update("company", event.target.value)} placeholder="e.g. NVIDIA" /></label>
        <label><span>Job title</span><input value={value.title} onChange={event => update("title", event.target.value)} placeholder="e.g. Software Engineering Intern" /></label>
      </div>
      <label className="job-url"><span>Job URL <small>optional — saved as reference only</small></span><input type="url" value={value.url} onChange={event => update("url", event.target.value)} placeholder="https://…" /></label>
      <label className="job-description"><span>Full job description</span><textarea value={value.description} onChange={event => update("description", event.target.value)} placeholder="Paste responsibilities, minimum qualifications, and preferred qualifications…" /><small>{value.description.length.toLocaleString()} characters · minimum 80</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <div className="analysis-progress" role="status"><i /><div><strong>{busy === "job" ? "Structuring the posting" : "Comparing confirmed evidence"}</strong><span>{busy === "job" ? "Separating requirements, tools, responsibilities, and keywords…" : "Calculating keyword coverage and tracing experience matches…"}</span></div></div>}
      <footer className="job-actions"><button className="back-button" type="button" onClick={onBack} disabled={Boolean(busy)}>← Review resume</button><div><span>Scores explain alignment—not interview odds.</span><button className="primary-button" type="button" disabled={!valid || Boolean(busy)} onClick={() => onGenerate(value)}>{busy ? "Working…" : "Generate fit analysis"} <b>→</b></button></div></footer>
    </article>
    <aside className="job-evidence-note"><span>Confirmed source</span><strong>{resume.name || "Master resume"}</strong><p>{resume.facts.length} evidence entries · {resume.skills.length} skills</p><hr /><p>The analysis can cite these facts, but it cannot create new ones.</p><div className="mini-facts">{resume.facts.slice(0, 4).map(fact => <span key={fact.id}><i />{fact.title || fact.organization || "Untitled evidence"}</span>)}</div></aside>
  </section>;
}

