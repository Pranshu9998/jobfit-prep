import { generateGeminiStructured, hasGeminiKey } from "../../../../lib/gemini";
import { AnalysisRequestSchema, MatchAnalysisSchema, SemanticEvaluationSchema } from "../../../../lib/analysis-schema";
import { assembleAnalysis, createLocalSemanticEvaluation } from "../../../../lib/match-analysis";
import { authorizeBetaAiRequest } from "../../../../lib/beta-ai";

export async function POST(request: Request) {
  const auth = await authorizeBetaAiRequest();
  if (!auth.user) return auth.response;
  try {
    const payload = AnalysisRequestSchema.parse(await request.json());
    if (!hasGeminiKey()) return Response.json(MatchAnalysisSchema.parse(assembleAnalysis(payload.resume, payload.job, createLocalSemanticEvaluation(payload.resume, payload.job), "deterministic-local")));

    const parsed = await generateGeminiStructured({
      schema: SemanticEvaluationSchema,
      systemInstruction: "Evaluate technical alignment and experience evidence between the confirmed resume facts and job requirements. Use only supplied fact IDs and requirement IDs. A matched item must have direct support. Use transferable when evidence is related but not direct. Use gap when unsupported. Never infer tools, years, employers, credentials, metrics, or experience. Scores measure document alignment, not interview probability. Return concise, specific explanations.",
      input: JSON.stringify({ confirmedResumeFacts: payload.resume.facts, confirmedSkills: payload.resume.skills, jobRequirements: payload.job.requirements }),
    });
    const validFactIds = new Set(payload.resume.facts.map(fact => fact.id));
    const validRequirementIds = new Set(payload.job.requirements.map(requirement => requirement.id));
    const sanitized = {
      ...parsed,
      evidenceMatches: parsed.evidenceMatches
        .filter(match => validRequirementIds.has(match.requirementId))
        .map(match => ({ ...match, sourceFactIds: match.sourceFactIds.filter(id => validFactIds.has(id)) })),
    };
    return Response.json(MatchAnalysisSchema.parse(assembleAnalysis(payload.resume, payload.job, sanitized, "hybrid-ai")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The fit analysis could not be generated.";
    return Response.json({ error: message }, { status: 400 });
  }
}
