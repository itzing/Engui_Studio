import { handleArtifactRequest } from "@/lib/mcp/artifacts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleArtifactRequest(request, (await context.params).token);
}
export const HEAD = GET;
