import { requireBetaApiUser } from "../../../lib/beta-auth";

export async function GET() {
  const auth = await requireBetaApiUser();
  if (!auth.user) return auth.response;
  return Response.json({ user: auth.user, signOutPath: "/auth/signout" });
}
