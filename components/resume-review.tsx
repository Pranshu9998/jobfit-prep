"use client";

import type { ResumeFact, ResumeProfile, ResumeSection } from "../lib/resume-schema";

const SECTION_LABELS: Record<ResumeSection, string> = {
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  research: "Research",
  leadership: "Leadership",
  awards: "Awards & honors",
  certifications: "Certifications",
  other: "Other",
};

export function ResumeReview({ profile, onChange, onBack, onConfirm }: { profile: ResumeProfile; onChange: (profile: ResumeProfile) => void; onBack: () => void; onConfirm: () => void }) {
  const update = <K extends keyof ResumeProfile>(key: K, value: ResumeProfile[K]) => onChange({ ...profile, [key]: value });
  const updateFact = (id: string, patch: Partial<ResumeFact>) => update("facts", profile.facts.map(fact => fact.id === id ? { ...fact, ...patch } : fact));
  const removeFact = (id: string) => update("facts", profile.facts.filter(fact => fact.id !== id));
  const addFact = () => update("facts", [...profile.facts, { id: `fact-${Date.now()}`, section: "other", title: "", organization: "", location: "", startDate: "", endDate: "", details: [""], keywords: [] }]);

  return (
    <section className="review-layout" aria-labelledby="review-title">
      <div className="review-paper">
        <header className="review-heading">
          <div><p>Confirm the source of truth</p><h1 id="review-title">Review every fact <em>before we tailor.</em></h1></div>
          <span className={`parser-badge ${profile.parser}`}>{profile.parser === "ai" ? "AI structured draft" : "Local draft · no API key"}</span>
        </header>
        <p className="review-intro">Correct anything the parser missed or grouped incorrectly. Only confirmed information will be allowed into the tailored resume.</p>

        <div className="identity-grid">
          <label><span>Name</span><input value={profile.name} onChange={event => update("name", event.target.value)} /></label>
          <label><span>Contact details <small>one per line</small></span><textarea value={profile.contact.join("\n")} onChange={event => update("contact", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} /></label>
        </div>
        <label className="full-field"><span>Professional summary <small>leave blank if your resume has none</small></span><textarea value={profile.summary} onChange={event => update("summary", event.target.value)} /></label>
        <label className="full-field"><span>Skills <small>comma separated</small></span><textarea value={profile.skills.join(", ")} onChange={event => update("skills", splitList(event.target.value))} /></label>

        <div className="facts-heading"><div><span>Confirmed evidence</span><strong>{profile.facts.length} entries</strong></div><button type="button" onClick={addFact}>+ Add missing entry</button></div>
        <div className="facts-list">
          {profile.facts.map((fact, index) => (
            <article className="fact-editor" key={fact.id}>
              <div className="fact-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="fact-fields">
                <div className="fact-topline">
                  <label><span>Section</span><select value={fact.section} onChange={event => updateFact(fact.id, { section: event.target.value as ResumeSection })}>{Object.entries(SECTION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <button type="button" onClick={() => removeFact(fact.id)} aria-label={`Remove ${fact.title || "resume entry"}`}>Remove</button>
                </div>
                <div className="fact-grid">
                  <label><span>Title</span><input value={fact.title} onChange={event => updateFact(fact.id, { title: event.target.value })} /></label>
                  <label><span>Organization</span><input value={fact.organization} onChange={event => updateFact(fact.id, { organization: event.target.value })} /></label>
                  <label><span>Location</span><input value={fact.location} onChange={event => updateFact(fact.id, { location: event.target.value })} /></label>
                  <label><span>Dates</span><div className="date-pair"><input aria-label="Start date" placeholder="Start" value={fact.startDate} onChange={event => updateFact(fact.id, { startDate: event.target.value })} /><input aria-label="End date" placeholder="End" value={fact.endDate} onChange={event => updateFact(fact.id, { endDate: event.target.value })} /></div></label>
                </div>
                <label className="details-field"><span>Evidence and achievements <small>one bullet per line</small></span><textarea value={fact.details.join("\n")} onChange={event => updateFact(fact.id, { details: event.target.value.split("\n") })} /></label>
              </div>
            </article>
          ))}
        </div>

        <footer className="review-actions">
          <button className="back-button" type="button" onClick={onBack}>← Replace resume</button>
          <div><span>Next: add the target job</span><button className="primary-button" type="button" onClick={onConfirm}>Confirm resume <b>→</b></button></div>
        </footer>
      </div>
      <aside className="source-note">
        <span>Source file</span><strong>{profile.sourceName}</strong><p>{profile.sourceText.length.toLocaleString()} characters extracted</p>
        <details><summary>Inspect extracted text</summary><pre>{profile.sourceText}</pre></details>
        <hr /><p>Edits made here become the only evidence available to the fit analysis.</p>
      </aside>
    </section>
  );
}

function splitList(value: string) {
  return value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean);
}
