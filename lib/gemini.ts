import { z } from "zod";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1/interactions";

type GeminiInteraction = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

function getOutputText(interaction: GeminiInteraction) {
  const modelSteps = (interaction.steps ?? []).filter(step => step.type === "model_output");
  const finalStep = modelSteps.at(-1);
  return (finalStep?.content ?? [])
    .filter(part => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("")
    .trim();
}

function cleanJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanJsonSchema);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema")
      .map(([key, child]) => [key, cleanJsonSchema(child)]),
  );
}

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateGeminiStructured<T>(options: {
  schema: z.ZodType<T>;
  systemInstruction: string;
  input: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
        system_instruction: options.systemInstruction,
        input: options.input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: cleanJsonSchema(z.toJSONSchema(options.schema)),
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini took too long to respond. Try this stage again.");
    }
    throw new Error("Could not reach the Gemini API. Check your connection and retry.");
  } finally {
    clearTimeout(timeout);
  }

  const interaction = (await response.json().catch(() => ({}))) as GeminiInteraction;
  if (!response.ok) {
    const detail = interaction.error?.message || `Gemini request failed (${response.status}).`;
    throw new Error(detail);
  }
  if (interaction.status && interaction.status !== "completed") {
    throw new Error(`Gemini did not complete the request (status: ${interaction.status}).`);
  }

  const outputText = getOutputText(interaction);
  if (!outputText) throw new Error("Gemini returned no structured output.");

  try {
    return options.schema.parse(JSON.parse(outputText));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid structured output.";
    throw new Error(`Gemini returned data that did not match the required format: ${detail}`);
  }
}
