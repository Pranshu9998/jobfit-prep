"use client";

import { useEffect, useState } from "react";
import { AnalysisResults } from "../components/analysis-results";
import { InterviewPackView } from "../components/interview-pack-view";
import { JobInput, type JobInputValue } from "../components/job-input";
import { ResumeReview } from "../components/resume-review";
import { TailoredResumeEditor } from "../components/tailored-resume-editor";
import { MatchAnalysisSchema, type MatchAnalysis } from "../lib/analysis-schema";
import { extractResumeFile } from "../lib/file-extraction";
import { JobProfileSchema, type JobProfile } from "../lib/job-schema";
import { InterviewPackSchema, type InterviewPack } from "../lib/interview-schema";
import { ResumeProfileSchema, type ResumeProfile } from "../lib/resume-schema";
import { TailoredResumeSchema, type TailoredResume } from "../lib/tailored-resume-schema";
import { clearJobFitStorage, loadJobFitStorage, recoverableStage, saveJobFitStorage, type RecentPrepPack, type WorkspaceSnapshot } from "../lib/browser-storage";

const steps = [
  ["01", "Resume", "Add your experience"], ["02", "Job", "Define the target"], ["03", "Analysis", "See your fit"], ["04", "Tailored resume", "Strengthen your story"], ["05", "Interview prep", "Practice with purpose"],
];

export default function Home() {
  const [stage, setStage] = useState<"resume" | "review" | "job" | "analysis" | "tailor" | "interview">("resume");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [resumeText, setResumeText] = useState("");
  const [sourceName, setSourceName] = useState("Pasted resume");
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [jobInput, setJobInput] = useState<JobInputValue | undefined>();
  const [job, setJob] = useState<JobProfile | null>(null);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [generatedTailored, setGeneratedTailored] = useState<TailoredResume | null>(null);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [interviewPack, setInterviewPack] = useState<InterviewPack | null>(null);
  const [busy, setBusy] = useState<"extracting" | "parsing" | null>(null);
  const [fitBusy, setFitBusy] = useState<"job" | "analysis" | null>(null);
  const [tailorBusy, setTailorBusy] = useState(false);
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [recentPrepPacks, setRecentPrepPacks] = useState<RecentPrepPack[]>([]);
  const [storageNotice, setStorageNotice] = useState("");
  const [aiStatus, setAiStatus] = useState<"checking" | "gemini" | "local">("checking");
  const [account, setAccount] = useState<{ displayName: string; email: string; localDev: boolean } | null>(null);
  const [signOutPath, setSignOutPath] = useState("");
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "saving" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    async function hydrateWorkspace() {
      const local = loadJobFitStorage(window.localStorage);
      const incompatible = !local && Boolean(window.localStorage.getItem("jobfit-prep:workspace"));
      if (incompatible) clearJobFitStorage(window.localStorage);
      const [accountResult, cloudResult, aiResult] = await Promise.allSettled([
        fetch("/api/account").then(response => response.ok ? response.json() : Promise.reject(new Error("Account unavailable"))),
        fetch("/api/workspace").then(response => response.ok ? response.json() : Promise.reject(new Error("Cloud workspace unavailable"))),
        fetch("/api/ai/status").then(response => response.json()),
      ]);
      if (cancelled) return;
      if (accountResult.status === "fulfilled") { setAccount(accountResult.value.user); setSignOutPath(accountResult.value.signOutPath || ""); }
      if (aiResult.status === "fulfilled") setAiStatus(aiResult.value.provider === "gemini" ? "gemini" : "local");
      else setAiStatus("local");
      const cloud = cloudResult.status === "fulfilled" ? cloudResult.value.document : null;
      const restored = cloud ?? local;
      if (restored) {
        const saved = restored.workspace;
        setStage(recoverableStage(saved)); setInputMode(saved.inputMode); setResumeText(saved.resumeText); setSourceName(saved.sourceName);
        setProfile(saved.profile); setJobInput(saved.jobInput ?? undefined); setJob(saved.job); setAnalysis(saved.analysis);
        setGeneratedTailored(saved.generatedTailored); setTailored(saved.tailored); setInterviewPack(saved.interviewPack);
        setRecentPrepPacks(restored.recentPrepPacks);
      }
      if (cloudResult.status === "rejected") { setSyncStatus("offline"); setStorageNotice("Cloud sync is unavailable. This device will keep a local recovery copy."); }
      else { setSyncStatus("synced"); if (incompatible && !restored) setStorageNotice("An incompatible saved workspace was safely reset."); }
      setHydrated(true);
    }
    void hydrateWorkspace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const workspace: WorkspaceSnapshot = { stage, inputMode, resumeText, sourceName, profile, jobInput: jobInput ?? null, job, analysis, generatedTailored, tailored, interviewPack };
      const result = saveJobFitStorage(window.localStorage, workspace, recentPrepPacks);
      if (!result.ok) setStorageNotice(result.reason === "quota" ? "Browser storage is full. Clear local data to recover saving." : "This browser blocked local saving. Your current session still works.");
      else {
        setSyncStatus("saving");
        void fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.document) })
          .then(response => { if (!response.ok) throw new Error("Cloud save failed"); setSyncStatus("synced"); setStorageNotice(current => current.includes("sync") || current.includes("saving") ? "" : current); })
          .catch(() => { setSyncStatus("offline"); setStorageNotice("Cloud sync paused. This device still has a local recovery copy."); });
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hydrated, stage, inputMode, resumeText, sourceName, profile, jobInput, job, analysis, generatedTailored, tailored, interviewPack, recentPrepPacks]);

  async function selectFile(file?: File) {
    if (!file) return;
    setBusy("extracting"); setError("");
    try { setResumeText(await extractResumeFile(file)); setSourceName(file.name); setInputMode("upload"); }
    catch (reason) { setResumeText(""); setError(reason instanceof Error ? reason.message : "That resume could not be read."); }
    finally { setBusy(null); }
  }

  async function parseResume() {
    const text = resumeText.trim();
    if (text.length < 20) { setError("Add at least 20 characters of resume text first."); return; }
    setBusy("parsing"); setError("");
    try {
      const response = await fetch("/api/resume/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, fileName: inputMode === "paste" ? "Pasted resume" : sourceName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The resume could not be parsed.");
      setProfile(ResumeProfileSchema.parse(data)); setStage("review");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The resume could not be parsed."); }
    finally { setBusy(null); }
  }

  async function generateAnalysis(value: JobInputValue) {
    if (!profile) return;
    setJobInput(value); setError(""); setFitBusy("job");
    try {
      const jobResponse = await fetch("/api/job/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const jobData = await jobResponse.json();
      if (!jobResponse.ok) throw new Error(jobData.error || "The job description could not be parsed.");
      const parsedJob = JobProfileSchema.parse(jobData);
      setJob(parsedJob); setFitBusy("analysis");
      const analysisResponse = await fetch("/api/analysis/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: profile, job: parsedJob }) });
      const analysisData = await analysisResponse.json();
      if (!analysisResponse.ok) throw new Error(analysisData.error || "The fit analysis could not be generated.");
      setAnalysis(MatchAnalysisSchema.parse(analysisData)); setStage("analysis");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The fit analysis could not be generated."); }
    finally { setFitBusy(null); }
  }

  async function generateTailoredResume() {
    if (!profile || !job || !analysis) return;
    setTailorBusy(true); setError("");
    try {
      const response = await fetch("/api/resume/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: profile, job, analysis }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The tailored resume could not be generated.");
      const result = TailoredResumeSchema.parse(data);
      setGeneratedTailored(structuredClone(result)); setTailored(result); setStage("tailor");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The tailored resume could not be generated."); }
    finally { setTailorBusy(false); }
  }

  async function generateInterviewPack() {
    if (!profile || !job || !analysis || !tailored) return;
    setInterviewBusy(true); setError("");
    try {
      const response = await fetch("/api/interview/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: profile, job, analysis, tailoredResume: tailored }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The interview pack could not be generated.");
      const result = InterviewPackSchema.parse(data);
      setInterviewPack(result);
      setRecentPrepPacks(current => [{ id: `${Date.now()}-${job.company}-${job.title}`, createdAt: new Date().toISOString(), job, analysis, tailoredResume: tailored, interviewPack: result }, ...current].slice(0, 5));
      setStage("interview");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The interview pack could not be generated."); }
    finally { setInterviewBusy(false); }
  }

  const activeStep = stage === "resume" || stage === "review" ? 0 : stage === "job" ? 1 : stage === "analysis" ? 2 : stage === "tailor" ? 3 : 4;

  function startNewJob() {
    if (!profile) return;
    setJobInput(undefined); setJob(null); setAnalysis(null); setGeneratedTailored(null); setTailored(null); setInterviewPack(null); setError(""); setStage("job");
  }

  async function clearAllData() {
    if (!window.confirm("Delete your saved resume, current draft, and recent prep packs from this account and device?")) return;
    clearJobFitStorage(window.localStorage);
    setStage("resume"); setInputMode("upload"); setResumeText(""); setSourceName("Pasted resume"); setProfile(null); setJobInput(undefined); setJob(null); setAnalysis(null); setGeneratedTailored(null); setTailored(null); setInterviewPack(null); setRecentPrepPacks([]); setError("");
    try {
      const response = await fetch("/api/workspace", { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setSyncStatus("synced"); setStorageNotice("Account data cleared.");
    } catch { setSyncStatus("offline"); setStorageNotice("Local data cleared, but the cloud copy could not be removed. Try again when sync returns."); }
  }

  function openRecentPack(pack: RecentPrepPack) {
    setJob(pack.job); setAnalysis(pack.analysis); setGeneratedTailored(structuredClone(pack.tailoredResume));
    setTailored(structuredClone(pack.tailoredResume)); setInterviewPack(pack.interviewPack); setError(""); setStage("interview");
  }

  return (
    <div className="app-shell">
      <Header aiStatus={aiStatus} account={account} signOutPath={signOutPath} syncStatus={syncStatus} hasProfile={Boolean(profile)} onNewJob={startNewJob} onClear={() => void clearAllData()} />
      <main id="main">
        <Workflow activeStep={activeStep} />
        {storageNotice && <div className="storage-notice" role="status"><span>{storageNotice}</span><button type="button" onClick={() => void clearAllData()}>Clear account data</button></div>}
        {stage === "review" && profile ? (
          <><div className="workspace-label"><span>Resume review</span><b>01 / Confirmed evidence</b></div><ResumeReview profile={profile} onChange={setProfile} onBack={() => { setProfile(null); setStage("resume"); }} onConfirm={() => { setError(""); setStage("job"); }} /></>
        ) : stage === "job" && profile ? (
          <><div className="workspace-label"><span>Target job</span><b>02 / Structured posting</b></div><JobInput resume={profile} initialValue={jobInput} busy={fitBusy} error={error} onBack={() => { setError(""); setStage("review"); }} onGenerate={value => void generateAnalysis(value)} /></>
        ) : stage === "analysis" && job && analysis ? (
          <><div className="workspace-label"><span>Fit analysis</span><b>03 / Evidence comparison</b></div><AnalysisResults job={job} analysis={analysis} onBack={() => { setError(""); setStage("job"); }} onTailor={() => void generateTailoredResume()} busy={tailorBusy} error={error} /></>
        ) : stage === "tailor" && profile && tailored ? (
          <><div className="workspace-label"><span>Tailored resume</span><b>04 / Guarded rewrite</b></div><TailoredResumeEditor resume={profile} tailored={tailored} onChange={setTailored} onUndo={() => generatedTailored && setTailored(structuredClone(generatedTailored))} onBack={() => { setError(""); setStage("analysis"); }} onContinue={() => void generateInterviewPack()} busy={interviewBusy} error={error} /></>
        ) : stage === "interview" && interviewPack && job && tailored ? (
          <><div className="workspace-label"><span>Interview prep</span><b>05 / Questions + exports</b></div><InterviewPackView pack={interviewPack} job={job} resume={tailored} onBack={() => { setError(""); setStage("tailor"); }} /></>
        ) : (
          <><div className="workspace-label"><span>Application workbench</span><b>01 / Resume source</b></div><section className="workspace-grid">
            <article className="input-card">
              <div className="eyebrow"><span />One job at a time</div>
              <h1>Build the strongest application <em>for one specific job.</em></h1>
              <p className="lede">Start with your master resume. We’ll connect your real experience to the role, surface honest gaps, and build a tailored resume plus interview prep pack.</p>
              <div className="tabs" role="tablist" aria-label="Resume input method">
                <button type="button" role="tab" aria-selected={inputMode === "upload"} className={inputMode === "upload" ? "is-active" : ""} onClick={() => { setInputMode("upload"); setError(""); }}>Upload a file</button>
                <button type="button" role="tab" aria-selected={inputMode === "paste"} className={inputMode === "paste" ? "is-active" : ""} onClick={() => { setInputMode("paste"); setSourceName("Pasted resume"); setError(""); }}>Paste resume text</button>
              </div>
              {inputMode === "upload" ? <label className={`dropzone ${resumeText ? "has-file" : ""}`} htmlFor="resume-file" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void selectFile(event.dataTransfer.files[0]); }}>
                <input id="resume-file" type="file" accept=".pdf,.docx,.txt" onChange={event => void selectFile(event.target.files?.[0])} />
                <span className="file-types">PDF · DOCX · TXT</span><span className="upload-icon" aria-hidden="true">{busy === "extracting" ? "…" : resumeText ? "✓" : "↑"}</span>
                <strong>{busy === "extracting" ? "Reading your resume…" : resumeText ? sourceName : "Drop your master resume here"}</strong>
                <span>{resumeText ? `${resumeText.length.toLocaleString()} characters ready for review` : <>or <b>browse your files</b> to choose one</>}</span><small>Maximum file size: 5 MB</small>
              </label> : <div className="paste-field"><label htmlFor="resume-text">Master resume text</label><textarea id="resume-text" value={resumeText} onChange={event => setResumeText(event.target.value)} placeholder="Paste your education, experience, projects, and skills here…" /><span>{resumeText.length.toLocaleString()} characters</span></div>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="input-footer"><p><span aria-hidden="true">✓</span>You’ll review every extracted fact before anything is generated. We never invent experience.</p><button className="primary-button" type="button" disabled={Boolean(busy) || resumeText.trim().length < 20} onClick={() => void parseResume()}>{busy === "parsing" ? "Structuring resume…" : "Review extracted facts"} <span aria-hidden="true">→</span></button></div>
            </article>
            <div className="side-stack"><Preview />{recentPrepPacks.length > 0 && <RecentPacks packs={recentPrepPacks} onOpen={openRecentPack} />}</div>
          </section></>
        )}
      </main>
    </div>
  );
}

function Header({ aiStatus, account, signOutPath, syncStatus, hasProfile, onNewJob, onClear }: { aiStatus: "checking" | "gemini" | "local"; account: { displayName: string; email: string; localDev: boolean } | null; signOutPath: string; syncStatus: "loading" | "synced" | "saving" | "offline"; hasProfile: boolean; onNewJob: () => void; onClear: () => void }) { return <header className="topbar"><a className="brand" href="#main" aria-label="JobFit Prep home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span className="brand-name">JobFit Prep</span><span className="local-pill">Private beta</span></a><div className="header-actions"><span className={`ai-pill ${aiStatus}`}>{aiStatus === "gemini" ? "Gemini active" : aiStatus === "local" ? "Local fallback" : "Checking AI"}</span><span className={`sync-pill ${syncStatus}`}><i aria-hidden="true" />{syncStatus === "synced" ? "Cloud synced" : syncStatus === "saving" ? "Saving" : syncStatus === "offline" ? "Local recovery" : "Loading"}</span>{account && <span className="account-pill" title={account.email}>{account.displayName}</span>}{hasProfile && <button className="header-button" type="button" onClick={onNewJob}>New job</button>}<button className="header-button danger" type="button" onClick={onClear}>Clear data</button>{account && !account.localDev && signOutPath && <a className="header-button" href={signOutPath}>Sign out</a>}</div></header>; }
function Workflow({ activeStep }: { activeStep: number }) { return <nav className="workflow" aria-label="Application prep workflow">{steps.map(([number, label, description], index) => <div className={`workflow-step ${index === activeStep ? "is-active" : ""} ${index < activeStep ? "is-complete" : ""}`} key={number} aria-current={index === activeStep ? "step" : undefined}><span className="step-number">{index < activeStep ? "✓" : number}</span><span className="step-copy"><strong>{label}</strong><small>{description}</small></span></div>)}</nav>; }
function Preview() { return <aside className="side-stack" id="how-it-works"><section className="preview-card" aria-labelledby="preview-title"><div className="preview-header"><div><p>A look ahead</p><h2 id="preview-title">Your fit analysis</h2></div><span>Sample</span></div><div className="score-row"><div className="score-ring" aria-label="Sample overall fit score: 78 percent"><span>78<small>%</small></span></div><div><h3>Strong foundation</h3><p>Your technical projects align well. A few role-specific gaps need honest positioning.</p></div></div><ScoreMeter label="Technical alignment" value={84} /><ScoreMeter label="Experience evidence" value={76} /><div className="insights"><div className="insight strength"><span aria-hidden="true">✓</span><div><small>Strengths</small><strong>Verilog + hands-on debugging</strong></div></div><div className="insight gap"><span aria-hidden="true">!</span><div><small>Gaps to prepare</small><strong>UVM + formal verification</strong></div></div></div><p className="score-disclaimer"><span aria-hidden="true">✦</span>A fit score explains alignment—not your odds of an interview.</p></section><section className="deliverables-card"><h2>What you’ll leave with</h2><div>{["Clear fit analysis", "Tailored resume", "Honest skill gaps", "Interview prep pack"].map(item => <span key={item}><i aria-hidden="true">✓</i>{item}</span>)}</div></section></aside>; }
function ScoreMeter({ label, value }: { label: string; value: number }) { return <div className="meter"><div><span>{label}</span><strong>{value}%</strong></div><span className="meter-track"><i style={{ width: `${value}%` }} /></span></div>; }
function RecentPacks({ packs, onOpen }: { packs: RecentPrepPack[]; onOpen: (pack: RecentPrepPack) => void }) { return <section className="recent-packs" aria-labelledby="recent-packs-title"><div><p>Saved to your account</p><h2 id="recent-packs-title">Recent prep packs</h2></div><ol>{packs.map(pack => <li key={pack.id}><button type="button" onClick={() => onOpen(pack)}><span><strong>{pack.job.title}</strong><small>{pack.job.company} · {new Date(pack.createdAt).toLocaleDateString()}</small></span><b>{pack.analysis.scores.overall}%</b></button></li>)}</ol></section>; }
