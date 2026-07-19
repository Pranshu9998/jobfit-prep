import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InterviewPack } from "../lib/interview-schema";
import type { JobProfile } from "../lib/job-schema";
import type { ResumeSection } from "../lib/resume-schema";
import type { TailoredResume } from "../lib/tailored-resume-schema";

const resumeStyles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 34, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 8.4, color: "#20202a", lineHeight: 1.3 },
  name: { fontFamily: "Times-Roman", fontSize: 22, lineHeight: 1.15, textAlign: "center", marginBottom: 4 },
  contact: { fontSize: 7.5, lineHeight: 1.2, textAlign: "center", color: "#55545e", marginBottom: 11 },
  section: { marginTop: 9 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.3, letterSpacing: 1.1, textTransform: "uppercase", borderBottomWidth: .7, borderBottomColor: "#35343d", paddingBottom: 3, marginBottom: 5 },
  summary: { color: "#3f3e47", lineHeight: 1.35 },
  entry: { marginBottom: 7 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  entryLeft: { flexGrow: 1, flexShrink: 1 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 8.6 },
  organization: { fontFamily: "Helvetica-Oblique", fontSize: 8.1, marginTop: 1 },
  entryRight: { width: 140, textAlign: "right", color: "#4e4d56", fontSize: 7.6 },
  bulletRow: { flexDirection: "row", marginTop: 2, paddingLeft: 4 },
  bullet: { width: 10 },
  bulletText: { flex: 1 },
  footer: { position: "absolute", bottom: 17, left: 42, right: 42, color: "#777680", fontSize: 6.5, flexDirection: "row", justifyContent: "space-between" },
});

const prepStyles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 40, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 8.5, color: "#24232e", lineHeight: 1.35 },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#6552dc", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontFamily: "Times-Roman", fontSize: 24, lineHeight: 1.18, marginTop: 5, marginBottom: 4 },
  role: { color: "#65636f", fontSize: 8.5, lineHeight: 1.2, marginBottom: 13 },
  pitch: { borderLeftWidth: 3, borderLeftColor: "#f36f58", backgroundColor: "#f6f3ed", padding: 10, marginBottom: 12 },
  pitchLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#6552dc", textTransform: "uppercase", marginBottom: 4 },
  grid: { flexDirection: "row", gap: 9, marginBottom: 9 },
  card: { flex: 1, borderWidth: .7, borderColor: "#c9c5cf", padding: 9, minHeight: 105 },
  cardFull: { flex: 0, minHeight: 82 },
  cardGreen: { backgroundColor: "#e8f4ef" },
  cardAmber: { backgroundColor: "#fff1d7" },
  cardViolet: { backgroundColor: "#f0edff" },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 7.4, textTransform: "uppercase", letterSpacing: .7, marginBottom: 6 },
  listRow: { flexDirection: "row", marginBottom: 3 },
  listMark: { width: 9, color: "#6552dc" },
  listText: { flex: 1, fontSize: 7.5 },
  questionHeader: { borderBottomWidth: 1, borderBottomColor: "#373641", paddingBottom: 7, marginBottom: 12 },
  questionType: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#6552dc", textTransform: "uppercase", letterSpacing: 1 },
  questionCount: { fontFamily: "Times-Roman", fontSize: 21, marginTop: 3 },
  question: { borderWidth: .7, borderColor: "#c9c5cf", padding: 11, marginBottom: 9 },
  questionMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  tag: { fontFamily: "Helvetica-Bold", fontSize: 6.5, color: "#6552dc", textTransform: "uppercase" },
  why: { color: "#686671", fontSize: 7.3, marginBottom: 6 },
  questionText: { fontFamily: "Times-Roman", fontSize: 12.5, lineHeight: 1.25, marginBottom: 7 },
  evidence: { backgroundColor: "#f2efff", padding: 6, fontSize: 7, color: "#514b70", marginBottom: 6 },
  outlineTitle: { fontFamily: "Helvetica-Bold", fontSize: 6.8, textTransform: "uppercase", marginBottom: 4 },
  footer: { position: "absolute", bottom: 17, left: 42, right: 42, color: "#777680", fontSize: 6.5, flexDirection: "row", justifyContent: "space-between" },
});

const SECTION_LABELS: Record<ResumeSection, string> = { education: "Education", experience: "Experience", projects: "Projects", research: "Research", leadership: "Leadership & Service", awards: "Awards & Honors", certifications: "Certifications", other: "Additional Experience" };

export function ResumePdfDocument({ resume, job }: { resume: TailoredResume; job: JobProfile }) {
  const groups = groupResumeEntries(resume);
  return <Document title={`${resume.name} - ${job.title} Resume`} author={resume.name} subject={`Tailored resume for ${job.company}`}>
    <Page size="LETTER" style={resumeStyles.page}>
      <Text style={resumeStyles.name}>{pdfText(resume.name)}</Text>
      <Text style={resumeStyles.contact}>{pdfText(resume.contact.join(" | "))}</Text>
      {resume.summary && <View style={resumeStyles.section}><Text style={resumeStyles.sectionTitle}>Profile</Text><Text style={resumeStyles.summary}>{pdfText(resume.summary)}</Text></View>}
      {resume.selectedSkills.length > 0 && <View style={resumeStyles.section}><Text style={resumeStyles.sectionTitle}>Skills</Text><Text>{pdfText(resume.selectedSkills.join(" | "))}</Text></View>}
      {groups.map(([section, entries]) => <View style={resumeStyles.section} key={section} wrap><Text style={resumeStyles.sectionTitle}>{SECTION_LABELS[section]}</Text>{entries.map(entry => <View style={resumeStyles.entry} key={entry.sourceFactId} wrap={false}>
        <View style={resumeStyles.entryHeader}><View style={resumeStyles.entryLeft}><Text style={resumeStyles.title}>{pdfText(entry.title)}</Text>{entry.organization && <Text style={resumeStyles.organization}>{pdfText(entry.organization)}</Text>}</View><View style={resumeStyles.entryRight}><Text>{pdfText(entry.location)}</Text><Text>{pdfText(entryDate(entry.title, entry.startDate, entry.endDate))}</Text></View></View>
        {entry.bullets.map(bullet => <View style={resumeStyles.bulletRow} key={bullet.id}><Text style={resumeStyles.bullet}>-</Text><Text style={resumeStyles.bulletText}>{pdfText(bullet.text)}</Text></View>)}
      </View>)}</View>)}
      <View style={resumeStyles.footer} fixed><Text>{pdfText(`Prepared for ${job.company} - ${job.title}`)}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
    </Page>
  </Document>;
}

export function InterviewPrepPdfDocument({ pack, job, candidateName }: { pack: InterviewPack; job: JobProfile; candidateName: string }) {
  const groups = (["technical", "resume", "behavioral"] as const).map(type => [type, pack.questions.filter(question => question.type === type)] as const);
  return <Document title={`${candidateName} - ${job.title} Interview Prep`} author={candidateName} subject={`Interview preparation for ${job.company}`}>
    <Page size="LETTER" style={prepStyles.page}>
      <Text style={prepStyles.kicker}>JobFit Prep / One-page brief</Text><Text style={prepStyles.title}>Interview prep sheet</Text><Text style={prepStyles.role}>{pdfText(`${candidateName} | ${job.company} | ${job.title}`)}</Text>
      <View style={prepStyles.pitch}><Text style={prepStyles.pitchLabel}>Opening pitch</Text><Text>{pdfText(pack.prepSheet.openingPitch)}</Text></View>
      <View style={prepStyles.grid}><PrepCard title="Priority skills" items={pack.prepSheet.prioritySkills} tone={prepStyles.cardGreen} /><PrepCard title="Likely technical topics" items={pack.prepSheet.likelyTechnicalTopics} tone={prepStyles.cardViolet} /></View>
      <View style={prepStyles.grid}><PrepCard title="Strongest stories" items={pack.prepSheet.strongestStories} tone={prepStyles.cardGreen} /><PrepCard title="Gaps to handle honestly" items={pack.prepSheet.honestGaps} tone={prepStyles.cardAmber} /></View>
      <View style={[prepStyles.card, prepStyles.cardFull, prepStyles.cardViolet]}><Text style={prepStyles.cardTitle}>Behavioral stories</Text>{pack.prepSheet.behavioralStories.map(item => <ListItem key={item} text={item} />)}</View>
      <PdfFooter label="Interview prep sheet" />
    </Page>
    {groups.flatMap(([type, questions]) => chunk(questions, 3).map((questionChunk, chunkIndex, chunks) => <Page size="LETTER" style={prepStyles.page} key={`${type}-${chunkIndex}`}>
      <View style={prepStyles.questionHeader}><Text style={prepStyles.questionType}>{pdfText(`${type} questions / ${chunkIndex + 1} of ${chunks.length}`)}</Text><Text style={prepStyles.questionCount}>{questions.length} targeted prompts</Text></View>
      {questionChunk.map((question, index) => <View style={prepStyles.question} key={question.id} wrap={false}><View style={prepStyles.questionMeta}><Text style={prepStyles.tag}>{pdfText(`${String(chunkIndex * 3 + index + 1).padStart(2, "0")} / ${question.tag}`)}</Text><Text style={prepStyles.tag}>{pdfText(question.evidence.join(" | "))}</Text></View><Text style={prepStyles.questionText}>{pdfText(question.question)}</Text><Text style={prepStyles.why}>{pdfText(`Why likely: ${question.whyLikely}`)}</Text><Text style={prepStyles.evidence}>{pdfText(`Evidence trigger: ${question.evidence.join(" | ")}`)}</Text><Text style={prepStyles.outlineTitle}>Preparation outline</Text>{question.preparationOutline.map(item => <ListItem key={item} text={item} />)}</View>)}
      <PdfFooter label={`${type} questions`} />
    </Page>))}
  </Document>;
}

function PrepCard({ title, items, tone }: { title: string; items: string[]; tone: object }) { return <View style={[prepStyles.card, tone]}><Text style={prepStyles.cardTitle}>{title}</Text>{(items.length ? items : ["No items detected"]).map(item => <ListItem key={item} text={item} />)}</View>; }
function ListItem({ text }: { text: string }) { return <View style={prepStyles.listRow}><Text style={prepStyles.listMark}>-</Text><Text style={prepStyles.listText}>{pdfText(text)}</Text></View>; }
function PdfFooter({ label }: { label: string }) { return <View style={prepStyles.footer} fixed><Text>{label}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>; }
function groupResumeEntries(resume: TailoredResume) { const map = new Map<ResumeSection, TailoredResume["entries"]>(); for (const entry of resume.entries) map.set(entry.section, [...(map.get(entry.section) ?? []), entry]); return Array.from(map.entries()); }
function chunk<T>(values: T[], size: number) { const chunks: T[][] = []; for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size)); return chunks; }
function entryDate(title: string, startDate: string, endDate: string) { const visibleEnd = endDate && title.includes(endDate) ? "" : endDate; return [startDate, visibleEnd].filter(Boolean).join(" - "); }
function pdfText(value: string) { return value.replace(/[–—]/g, "-").replace(/∼/g, "~").replace(/≈/g, "~").replace(/→/g, "->").replace(/↗/g, "up"); }
