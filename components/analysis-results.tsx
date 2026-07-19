"use client";

import type { MatchAnalysis } from "../lib/analysis-schema";
import type { JobProfile } from "../lib/job-schema";

export function AnalysisResults({ job, analysis, onBack, onTailor, busy, error }: { job: JobProfile; analysis: MatchAnalysis; onBack: () => void; onTailor: () => void; busy: boolean; error: string }) {
  const visibleMatches = analysis.evidenceMatches.filter(match => match.status !== "gap");
  const gapMatches = analysis.evidenceMatches.filter(match => match.status === "gap");
  return <section className="analysis-layout" aria-labelledby="analysis-title">
    <article className="analysis-report">
      <header className="analysis-heading"><div><p>{job.company} · {job.title}</p><h1 id="analysis-title">Your evidence, <em>against this role.</em></h1></div><span className={`parser-badge ${analysis.evaluator === "hybrid-ai" ? "ai" : "local"}`}>{analysis.evaluator === "hybrid-ai" ? "Hybrid AI evaluation" : "Deterministic local evaluation"}</span></header>
      <div className="analysis-scoreboard">
        <div className="overall-score"><span>Overall document fit</span><strong>{analysis.scores.overall}<small>/100</small></strong><p>This measures resume-to-posting alignment. It is not an interview-probability estimate.</p></div>
        <div className="weighted-scores">
          <WeightedScore label="Technical" score={analysis.scores.technical} weight="45%" explanation={analysis.scoreExplanation.technical} />
          <WeightedScore label="Experience" score={analysis.scores.experience} weight="30%" explanation={analysis.scoreExplanation.experience} />
          <WeightedScore label="Keywords" score={analysis.scores.keyword} weight="25%" explanation={analysis.scoreExplanation.keyword} />
        </div>
      </div>
      <div className="formula-strip"><span>Exact calculation</span><code>{analysis.scoreExplanation.overall}</code></div>

      <div className="analysis-columns">
        <InsightList title="Evidence-backed strengths" tone="positive" items={analysis.strengths} />
        <InsightList title="Gaps to handle honestly" tone="warning" items={analysis.gaps} />
      </div>
      {analysis.risks.length > 0 && <InsightList title="Resume risks and caveats" tone="risk" items={analysis.risks} />}

      <section className="evidence-ledger"><header><div><span>Requirement ledger</span><h2>Why the analysis scored this way</h2></div><b>{analysis.evidenceMatches.length} traced checks</b></header>
        <div className="ledger-list">{[...visibleMatches, ...gapMatches].map(match => <article className={`ledger-item ${match.status}`} key={match.requirementId}><span className="ledger-status">{match.status === "matched" ? "✓" : match.status === "transferable" ? "↗" : "!"}</span><div><small>{match.status}</small><h3>{match.requirement}</h3><p>{match.explanation}</p>{match.evidence.length > 0 && <div className="evidence-chips">{match.evidence.map(item => <span key={item}>{item}</span>)}</div>}</div></article>)}</div>
      </section>

      <section className="keyword-audit"><div><span>Matched keywords</span><p>{analysis.matchedKeywords.length ? analysis.matchedKeywords.join(" · ") : "No normalized keyword matches detected."}</p></div><div><span>Missing keywords</span><p>{analysis.missingKeywords.length ? analysis.missingKeywords.join(" · ") : "No missing normalized keywords detected."}</p></div></section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="analysis-actions"><button className="back-button" type="button" onClick={onBack} disabled={busy}>← Edit job</button><div><span>Every generated claim will cite confirmed evidence.</span><button className="primary-button" type="button" disabled={busy} onClick={onTailor}>{busy ? "Validating claims…" : "Tailor resume"} <b>→</b></button></div></footer>
    </article>
    <aside className="requirements-note"><span>Parsed job brief</span><strong>{job.requirements.length} requirements</strong><p>{job.parser === "ai" ? "Structured with AI" : "Structured locally · no API key"}</p><hr /><RequirementGroup label="Required" values={job.requiredSkills} /><RequirementGroup label="Preferred" values={job.preferredSkills} /><RequirementGroup label="Tools detected" values={job.tools} /><details><summary>Inspect responsibilities</summary>{job.responsibilities.map(item => <p key={item}>{item}</p>)}</details></aside>
  </section>;
}

function WeightedScore({ label, score, weight, explanation }: { label: string; score: number; weight: string; explanation: string }) { return <div className="weighted-score"><div><span>{label}<small>{weight} weight</small></span><strong>{score}</strong></div><i><b style={{ width: `${score}%` }} /></i><p>{explanation}</p></div>; }
function InsightList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "warning" | "risk" }) { return <section className={`analysis-insight ${tone}`}><h2>{title}</h2><ul>{items.map((item, index) => <li key={`${item}-${index}`}><span>{tone === "positive" ? "✓" : "!"}</span>{item}</li>)}</ul></section>; }
function RequirementGroup({ label, values }: { label: string; values: string[] }) { if (!values.length) return null; return <div className="requirement-group"><b>{label}</b><div>{values.map(value => <span key={value}>{value}</span>)}</div></div>; }
