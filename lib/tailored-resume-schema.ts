import { z } from "zod";
import { MatchAnalysisSchema } from "./analysis-schema";
import { JobProfileSchema } from "./job-schema";
import { ResumeProfileSchema, ResumeSectionSchema } from "./resume-schema";

export const TailoredBulletDraftSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceFactIds: z.array(z.string()).min(1),
  sourceRequirementIds: z.array(z.string()),
  whyChanged: z.string(),
});

export const TailoredEntryDraftSchema = z.object({
  sourceFactId: z.string(),
  bullets: z.array(TailoredBulletDraftSchema),
  whyIncluded: z.string(),
});

export const TailoredResumeDraftSchema = z.object({
  selectedSkills: z.array(z.string()),
  entries: z.array(TailoredEntryDraftSchema),
  omittedFactIds: z.array(z.string()),
});

export const ClaimValidationSchema = z.object({
  status: z.enum(["valid", "flagged"]),
  issues: z.array(z.string()),
});

export const TailoredBulletSchema = TailoredBulletDraftSchema.extend({
  validation: ClaimValidationSchema,
});

export const TailoredEntrySchema = z.object({
  sourceFactId: z.string(),
  section: ResumeSectionSchema,
  title: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(TailoredBulletSchema),
  whyIncluded: z.string(),
});

export const TailoredResumeSchema = z.object({
  name: z.string(),
  contact: z.array(z.string()),
  summary: z.string(),
  selectedSkills: z.array(z.string()),
  entries: z.array(TailoredEntrySchema),
  omittedFactIds: z.array(z.string()),
  validation: z.object({
    valid: z.boolean(),
    issues: z.array(z.string()),
    checkedBullets: z.number().int().nonnegative(),
  }),
  generator: z.enum(["ai", "local"]),
});

export const TailorRequestSchema = z.object({
  resume: ResumeProfileSchema,
  job: JobProfileSchema,
  analysis: MatchAnalysisSchema,
});

export type TailoredResumeDraft = z.infer<typeof TailoredResumeDraftSchema>;
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;
export type TailoredEntry = z.infer<typeof TailoredEntrySchema>;
export type TailoredBullet = z.infer<typeof TailoredBulletSchema>;

