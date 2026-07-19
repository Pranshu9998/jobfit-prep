import { consumeDailyAiAllowance } from "../db/workspace-store";
import { requireBetaApiUser } from "./beta-auth";

export async function authorizeBetaAiRequest() {
  const auth = await requireBetaApiUser();
  if (!auth.user) return { user: null, response: auth.response } as const;
  try {
    const allowance = await consumeDailyAiAllowance(auth.user);
    if (!allowance.allowed) {
      return {
        user: null,
        response: Response.json({ error: `Daily usage limit reached (${allowance.limit} AI steps). Try again tomorrow.`, allowance }, { status: 429 }),
      } as const;
    }
    return { user: auth.user, response: null, allowance } as const;
  } catch {
    return { user: null, response: Response.json({ error: "Usage verification is temporarily unavailable." }, { status: 503 }) } as const;
  }
}
