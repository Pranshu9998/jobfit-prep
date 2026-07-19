import { deleteWorkspace, readWorkspace, writeWorkspace } from "../../../db/workspace-store";
import { requireBetaApiUser } from "../../../lib/beta-auth";
import { StorageDocumentSchema } from "../../../lib/browser-storage";

const MAX_WORKSPACE_BYTES = 1_500_000;

export async function GET() {
  const auth = await requireBetaApiUser();
  if (!auth.user) return auth.response;
  try {
    return Response.json({ document: await readWorkspace(auth.user.email) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The workspace could not be loaded." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireBetaApiUser();
  if (!auth.user) return auth.response;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WORKSPACE_BYTES) return Response.json({ error: "The saved workspace is too large." }, { status: 413 });
  try {
    const document = StorageDocumentSchema.parse(JSON.parse(raw));
    await writeWorkspace(auth.user, document);
    return Response.json({ saved: true, updatedAt: document.updatedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The workspace could not be saved." }, { status: 400 });
  }
}

export async function DELETE() {
  const auth = await requireBetaApiUser();
  if (!auth.user) return auth.response;
  try {
    await deleteWorkspace(auth.user.email);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The workspace could not be deleted." }, { status: 503 });
  }
}
