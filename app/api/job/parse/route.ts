import { generateGeminiStructured, hasGeminiKey } from "../../../../lib/gemini";
import { JobContentSchema, JobParseRequestSchema, JobProfileSchema } from "../../../../lib/job-schema";
import { createLocalJobProfile } from "../../../../lib/local-job-parser";
import { authorizeBetaAiRequest } from "../../../../lib/beta-ai";

export async function POST(request: Request) {
  const auth = await authorizeBetaAiRequest();
  if (!auth.user) return auth.response;
  try {
    const payload = JobParseRequestSchema.parse(await request.json());
    if (!hasGeminiKey()) return Response.json(createLocalJobProfile(payload));

    const parsed = await generateGeminiStructured({
      schema: JobContentSchema,
      systemInstruction: "Parse the job posting into the supplied schema. Preserve requirements faithfully and do not add industry assumptions. Distinguish required from preferred skills only when the posting supports that distinction. Give every requirement a stable unique id beginning req-. sourceText must quote or closely preserve the triggering posting phrase.",
      input: payload.description,
    });
    return Response.json(JobProfileSchema.parse({ ...parsed, ...payload, parser: "ai" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The job description could not be parsed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
