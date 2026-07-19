import { z } from "zod";

export const ResumeSectionSchema = z.enum([
  "education",
  "experience",
  "projects",
  "research",
  "leadership",
  "awards",
  "certifications",
  "other",
]);

export const ResumeFactSchema = z.object({
  id: z.string(),
  section: ResumeSectionSchema,
  title: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  details: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const ResumeContentSchema = z.object({
  name: z.string(),
  contact: z.array(z.string()),
  summary: z.string(),
  skills: z.array(z.string()),
  keywords: z.array(z.string()),
  facts: z.array(ResumeFactSchema),
});

export const ResumeProfileSchema = ResumeContentSchema.extend({
  sourceText: z.string(),
  sourceName: z.string(),
  parser: z.enum(["ai", "local"]),
});

export const ResumeParseRequestSchema = z.object({
  text: z.string().trim().min(20).max(100_000),
  fileName: z.string().trim().min(1).max(180),
});

export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
export type ResumeFact = z.infer<typeof ResumeFactSchema>;
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;
