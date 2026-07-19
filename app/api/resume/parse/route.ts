import { generateGeminiStructured, hasGeminiKey } from "../../../../lib/gemini";
import { createLocalResumeDraft } from "../../../../lib/local-resume-parser";
import { ResumeContentSchema, ResumeParseRequestSchema, ResumeProfileSchema } from "../../../../lib/resume-schema";
import { authorizeBetaAiRequest } from "../../../../lib/beta-ai";

export async function POST(request: Request) {
  const auth = await authorizeBetaAiRequest();
  if (!auth.user) return auth.response;
  try {
    const payload = ResumeParseRequestSchema.parse(await request.json());
    if (!hasGeminiKey()) return Response.json(createLocalResumeDraft(payload.text, payload.fileName));

    const parsed = await generateGeminiStructured({
      schema: ResumeContentSchema,
      systemInstruction: "Extract a resume into the supplied schema. Use only facts stated in the source. Never infer or invent employers, tools, dates, metrics, credentials, or achievements. Preserve measurable details verbatim. Use an empty string or empty array when information is absent. Give every fact a stable id such as fact-experience-1.",
      input: payload.text,
    });
    const profile = ResumeProfileSchema.parse({ ...parsed, sourceText: payload.text, sourceName: payload.fileName, parser: "ai" });
    return Response.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The resume could not be parsed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
