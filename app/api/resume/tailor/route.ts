import { generateGeminiStructured, hasGeminiKey } from "../../../../lib/gemini";
import { createLocalTailoredDraft, validateAndAssembleTailoredResume } from "../../../../lib/resume-tailoring";
import { TailoredResumeDraftSchema, TailoredResumeSchema, TailorRequestSchema } from "../../../../lib/tailored-resume-schema";
import { authorizeBetaAiRequest } from "../../../../lib/beta-ai";

export async function POST(request: Request) {
  const auth = await authorizeBetaAiRequest();
  if (!auth.user) return auth.response;
  try {
    const payload = TailorRequestSchema.parse(await request.json());
    if (!hasGeminiKey()) {
      const draft = createLocalTailoredDraft(payload.resume, payload.job, payload.analysis);
      return Response.json(TailoredResumeSchema.parse(validateAndAssembleTailoredResume(payload.resume, payload.job, draft, "local")));
    }

    const parsed = await generateGeminiStructured({
      schema: TailoredResumeDraftSchema,
      systemInstruction: "Tailor the confirmed resume to the supplied job. You may reorder facts and bullets, tighten wording, and emphasize supported keywords. Never create employers, projects, tools, certifications, dates, metrics, responsibilities, or achievements. Every bullet must cite at least one supplied source fact ID, including its parent entry sourceFactId. Cite only supplied job requirement IDs. If a skill is absent, omit it rather than adding it. Preserve the candidate's meaning and quantitative claims exactly. Return whyIncluded and whyChanged explanations that are specific and concise.",
      input: JSON.stringify({
            confirmedName: payload.resume.name,
            confirmedSkills: payload.resume.skills,
            confirmedFacts: payload.resume.facts,
            jobRequirements: payload.job.requirements,
            matchAnalysis: payload.analysis,
          }),
    });
    return Response.json(TailoredResumeSchema.parse(validateAndAssembleTailoredResume(payload.resume, payload.job, parsed, "ai")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tailored resume could not be generated.";
    return Response.json({ error: message }, { status: 400 });
  }
}
