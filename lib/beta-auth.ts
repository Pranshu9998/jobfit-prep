import { chatGPTSignInPath, getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";

export type BetaUser = ChatGPTUser & { localDev: boolean };

export async function getBetaUser(): Promise<BetaUser | null> {
  const user = await getChatGPTUser();
  if (user) return { ...user, localDev: false };

  const localEmail = process.env.LOCAL_DEV_USER_EMAIL?.trim();
  if (process.env.NODE_ENV !== "production" && localEmail) {
    const fullName = process.env.LOCAL_DEV_USER_NAME?.trim() || null;
    return { email: localEmail, fullName, displayName: fullName || localEmail, localDev: true };
  }
  return null;
}

export async function requireBetaApiUser() {
  const user = await getBetaUser();
  if (!user) return { user: null, response: Response.json({ error: "Sign in is required." }, { status: 401 }) } as const;
  return { user, response: null } as const;
}

export function betaSignInPath(returnTo = "/") {
  return chatGPTSignInPath(returnTo);
}
