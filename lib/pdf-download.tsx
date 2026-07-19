"use client";

import { pdf } from "@react-pdf/renderer";
import { InterviewPrepPdfDocument, ResumePdfDocument } from "../components/pdf-documents";
import type { InterviewPack } from "./interview-schema";
import type { JobProfile } from "./job-schema";
import type { TailoredResume } from "./tailored-resume-schema";

export async function createResumePdfBlob(resume: TailoredResume, job: JobProfile) {
  return pdf(<ResumePdfDocument resume={resume} job={job} />).toBlob();
}

export async function createInterviewPdfBlob(pack: InterviewPack, job: JobProfile, candidateName: string) {
  return pdf(<InterviewPrepPdfDocument pack={pack} job={job} candidateName={candidateName} />).toBlob();
}

