import { generateGeminiStructured, hasGeminiKey } from "../../../../lib/gemini";
import { createLocalInterviewPack, sanitizeInterviewPack } from "../../../../lib/interview-generation";
import { InterviewPackContentSchema, InterviewPackSchema, InterviewRequestSchema } from "../../../../lib/interview-schema";
import { authorizeBetaAiRequest } from "../../../../lib/beta-ai";

export async function POST(request: Request) {
  const auth = await authorizeBetaAiRequest();
  if (!auth.user) return auth.response;
  try {
    const payload = InterviewRequestSchema.parse(await request.json());
    if (!hasGeminiKey()) return Response.json(InterviewPackSchema.parse(createLocalInterviewPack(payload.resume, payload.job, payload.analysis)));
    const parsed = await generateGeminiStructured({
      schema: InterviewPackContentSchema,
      systemInstruction: "Create a job-specific interview pack from only the supplied confirmed resume facts and job requirements. Produce technical, resume-based, and behavioral questions. Tag each question resume, job, or both. Explain why it is likely, cite only supplied fact and requirement IDs, include visible evidence triggers, and give a concise four-step preparation outline. Do not write full scripted answers or invent candidate experience. The prep sheet must include priority skills, strongest confirmed stories, likely technical topics, gaps to handle honestly, behavioral stories, and a concise opening pitch grounded in confirmed evidence.",
      input: JSON.stringify({ resumeFacts: payload.resume.facts, skills: payload.resume.skills, job: payload.job, analysis: payload.analysis, tailoredResume: payload.tailoredResume }),
    });
    return Response.json(InterviewPackSchema.parse(sanitizeInterviewPack({ ...parsed, generator: "ai" }, payload.resume, payload.job, payload.analysis, "ai")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The interview pack could not be generated.";
    return Response.json({ error: message }, { status: 400 });
  }
}
