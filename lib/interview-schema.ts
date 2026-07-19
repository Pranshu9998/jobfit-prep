import { z } from "zod";
import { MatchAnalysisSchema } from "./analysis-schema";
import { JobProfileSchema } from "./job-schema";
import { ResumeProfileSchema } from "./resume-schema";
import { TailoredResumeSchema } from "./tailored-resume-schema";

export const InterviewQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["technical", "resume", "behavioral"]),
  tag: z.enum(["resume", "job", "both"]),
  question: z.string(),
  whyLikely: z.string(),
  sourceFactIds: z.array(z.string()),
  sourceRequirementIds: z.array(z.string()),
  evidence: z.array(z.string()),
  preparationOutline: z.array(z.string()),
});

export const PrepSheetSchema = z.object({
  prioritySkills: z.array(z.string()),
  strongestStories: z.array(z.string()),
  likelyTechnicalTopics: z.array(z.string()),
  honestGaps: z.array(z.string()),
  behavioralStories: z.array(z.string()),
  openingPitch: z.string(),
});

export const InterviewPackContentSchema = z.object({
  questions: z.array(InterviewQuestionSchema),
  prepSheet: PrepSheetSchema,
});

export const InterviewPackSchema = InterviewPackContentSchema.extend({ generator: z.enum(["ai", "local"]) });

export const InterviewRequestSchema = z.object({
  resume: ResumeProfileSchema,
  job: JobProfileSchema,
  analysis: MatchAnalysisSchema,
  tailoredResume: TailoredResumeSchema,
});

export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
export type PrepSheet = z.infer<typeof PrepSheetSchema>;
export type InterviewPack = z.infer<typeof InterviewPackSchema>;

