import { hasGeminiKey } from "../../../../lib/gemini";

export async function GET() {
  const configured = hasGeminiKey();
  return Response.json({
    provider: configured ? "gemini" : "local",
    model: configured ? process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash" : null,
  });
}
