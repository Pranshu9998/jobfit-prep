"use client";

import { useMemo, useState } from "react";
import type { ResumeProfile, ResumeSection } from "../lib/resume-schema";
import type { TailoredResume } from "../lib/tailored-resume-schema";

const SECTION_LABELS: Record<ResumeSection, string> = {
  education: "Education", experience: "Experience", projects: "Projects", research: "Research",
  leadership: "Leadership & Service", awards: "Awards & Honors", certifications: "Certifications", other: "Additional Experience",
};

export function TailoredResumeEditor({ resume, tailored, onChange, onUndo, onBack, onContinue, busy, error }: {
  resume: ResumeProfile;
  tailored: TailoredResume;
  onChange: (resume: TailoredResume) => void;
  onUndo: () => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
  error: string;
}) {
  const [copied, setCopied] = useState(false);
  const grouped = useMemo(() => groupEntries(tailored), [tailored]);
  const flagged = tailored.entries.flatMap(entry => entry.bullets).filter(bullet => bullet.validation.status === "flagged").length;

  function updateBullet(entryId: string, bulletId: string, text: string) {
    onChange({
      ...tailored,
      entries: tailored.entries.map(entry => entry.sourceFactId !== entryId ? entry : {
        ...entry,
        bullets: entry.bullets.map(bullet => bullet.id !== bulletId ? bullet : {
          ...bullet,
          text,
          validation: { status: "flagged" as const, issues: ["Edited after generation; confirm the wording still matches the cited source evidence."] },
        }),
      }),
      validation: { ...tailored.validation, valid: false, issues: [...tailored.validation.issues, "One or more bullets were edited after validation."] },
    });
  }

  async function copyResume() {
    await navigator.clipboard.writeText(toPlainText(tailored));
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <section className="tailor-layout" aria-labelledby="tailor-title">
    <article className="tailor-workbench">
      <header className="tailor-heading"><div><p>Guarded tailoring</p><h1 id="tailor-title">Stronger wording. <em>Same true story.</em></h1></div><span className={`validation-seal ${flagged ? "flagged" : "valid"}`}>{flagged ? `${flagged} flagged` : `${tailored.validation.checkedBullets} claims verified`}</span></header>
      <p className="tailor-intro">Employers, projects, titles, dates, and organizations are locked to confirmed facts. Every generated bullet shows its source and why it changed.</p>
      {tailored.validation.issues.length > 0 && <section className="claim-alert" role="alert"><strong>Review required</strong><ul>{Array.from(new Set(tailored.validation.issues)).map(issue => <li key={issue}>{issue}</li>)}</ul></section>}

      <div className="resume-sheet">
        <header><h2>{tailored.name}</h2><p>{tailored.contact.join(" · ")}</p></header>
        {tailored.summary && <section><h3>Profile</h3><p className="resume-summary">{tailored.summary}</p></section>}
        {tailored.selectedSkills.length > 0 && <section><h3>Skills</h3><p className="resume-skills">{tailored.selectedSkills.join(" · ")}</p></section>}
        {grouped.map(([section, entries]) => <section key={section}><h3>{SECTION_LABELS[section]}</h3>{entries.map(entry => {
          const source = resume.facts.find(fact => fact.id === entry.sourceFactId);
          return <article className="tailored-entry" key={entry.sourceFactId}>
            <div className="resume-entry-heading"><div><strong>{entry.title}</strong>{entry.organization && <span>{entry.organization}</span>}</div><div><span>{entry.location}</span><b>{[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}</b></div></div>
            <p className="why-included">{entry.whyIncluded}</p>
            <div className="tailored-bullets">{entry.bullets.map((bullet, index) => <div className={`tailored-bullet ${bullet.validation.status}`} key={bullet.id}>
              <span className="bullet-number">{String(index + 1).padStart(2, "0")}</span>
              <div><textarea aria-label={`Tailored bullet ${index + 1} for ${entry.title || entry.organization}`} value={bullet.text} onChange={event => updateBullet(entry.sourceFactId, bullet.id, event.target.value)} />
                <div className="bullet-audit"><span className="claim-status">{bullet.validation.status === "valid" ? "✓ Source verified" : "! Review claim"}</span><details><summary>Why this changed</summary><p>{bullet.whyChanged}</p></details><details><summary>Source evidence</summary><p>{source?.details.join(" ") || "No source detail available."}</p><code>{bullet.sourceFactIds.join(", ")}</code></details></div>
                {bullet.validation.issues.map(issue => <p className="bullet-issue" key={issue}>{issue}</p>)}
              </div>
            </div>)}</div>
          </article>;
        })}</section>)}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="tailor-actions"><button className="back-button" type="button" onClick={onBack} disabled={busy}>← Back to analysis</button><div><button className="secondary-button" type="button" onClick={onUndo} disabled={busy}>Undo generated</button><button className="secondary-button" type="button" onClick={() => void copyResume()} disabled={busy}>{copied ? "Copied ✓" : "Copy resume"}</button><button className="primary-button" type="button" onClick={onContinue} disabled={busy}>{busy ? "Building prep pack…" : "Create interview pack"} <b>→</b></button></div></footer>
    </article>
    <aside className="tailor-audit-note"><span>Generation audit</span><strong>{tailored.generator === "ai" ? "AI + deterministic guard" : "Local guarded rewrite"}</strong><p>{tailored.entries.length} included entries · {tailored.omittedFactIds.length} omitted</p><hr /><p>Generated bullets cannot introduce a job skill, target employer, date, or metric that is absent from cited evidence.</p><div className="audit-key"><span><i className="ok" />Verified against source</span><span><i className="warn" />Requires human review</span></div></aside>
  </section>;
}

function groupEntries(tailored: TailoredResume) {
  const groups = new Map<ResumeSection, TailoredResume["entries"]>();
  for (const entry of tailored.entries) groups.set(entry.section, [...(groups.get(entry.section) ?? []), entry]);
  return Array.from(groups.entries());
}

function toPlainText(resume: TailoredResume) {
  const lines = [resume.name, resume.contact.join(" | "), ""];
  if (resume.summary) lines.push("PROFILE", resume.summary, "");
  if (resume.selectedSkills.length) lines.push("SKILLS", resume.selectedSkills.join(", "), "");
  for (const [section, entries] of groupEntries(resume)) {
    lines.push(SECTION_LABELS[section].toUpperCase());
    for (const entry of entries) {
      lines.push([entry.title, entry.organization].filter(Boolean).join(" — "));
      lines.push([[entry.location, entry.startDate].filter(Boolean).join(" | "), entry.endDate].filter(Boolean).join(" – "));
      entry.bullets.forEach(bullet => lines.push(`• ${bullet.text}`));
      lines.push("");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
