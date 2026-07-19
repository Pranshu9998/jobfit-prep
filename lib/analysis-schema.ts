import { z } from "zod";
import { JobProfileSchema } from "./job-schema";
import { ResumeProfileSchema } from "./resume-schema";

export const ScoreBreakdownSchema = z.object({
  overall: z.number().min(0).max(100),
  technical: z.number().min(0).max(100),
  experience: z.number().min(0).max(100),
  keyword: z.number().min(0).max(100),
});

export const EvidenceMatchSchema = z.object({
  requirementId: z.string(),
  requirement: z.string(),
  status: z.enum(["matched", "transferable", "gap"]),
  sourceFactIds: z.array(z.string()),
  evidence: z.array(z.string()),
  explanation: z.string(),
});

export const MatchAnalysisSchema = z.object({
  scores: ScoreBreakdownSchema,
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risks: z.array(z.string()),
  evidenceMatches: z.array(EvidenceMatchSchema),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  scoreExplanation: z.object({
    technical: z.string(),
    experience: z.string(),
    keyword: z.string(),
    overall: z.string(),
  }),
  evaluator: z.enum(["hybrid-ai", "deterministic-local"]),
});

export const AnalysisRequestSchema = z.object({
  resume: ResumeProfileSchema,
  job: JobProfileSchema,
});

export const SemanticEvaluationSchema = z.object({
  technicalScore: z.number().min(0).max(100),
  experienceScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risks: z.array(z.string()),
  evidenceMatches: z.array(EvidenceMatchSchema),
  technicalExplanation: z.string(),
  experienceExplanation: z.string(),
});

export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;
export type EvidenceMatch = z.infer<typeof EvidenceMatchSchema>;
export type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;

