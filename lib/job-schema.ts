import { z } from "zod";

export const JobRequirementKindSchema = z.enum([
  "required_skill",
  "preferred_skill",
  "responsibility",
  "tool",
  "soft_skill",
  "experience",
]);

export const JobRequirementSchema = z.object({
  id: z.string(),
  kind: JobRequirementKindSchema,
  label: z.string(),
  sourceText: z.string(),
  priority: z.enum(["required", "preferred", "context"]),
});

export const JobContentSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  tools: z.array(z.string()),
  softSkills: z.array(z.string()),
  experienceExpectations: z.array(z.string()),
  keywords: z.array(z.string()),
  requirements: z.array(JobRequirementSchema),
});

export const JobProfileSchema = JobContentSchema.extend({
  company: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string(),
  parser: z.enum(["ai", "local"]),
});

export const JobParseRequestSchema = z.object({
  company: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(180),
  url: z.string().trim().max(2_000),
  description: z.string().trim().min(80).max(100_000),
});

export type JobRequirement = z.infer<typeof JobRequirementSchema>;
export type JobProfile = z.infer<typeof JobProfileSchema>;

