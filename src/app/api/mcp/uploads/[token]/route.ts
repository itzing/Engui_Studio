import { handleUploadRequest } from "@/lib/mcp/uploads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleUploadRequest(request, (await context.params).token);
}
