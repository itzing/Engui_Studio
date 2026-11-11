import { NextRequest, NextResponse } from "next/server";
import { withWorkspaceRoute } from "@/lib/workspaces/route";
import { saveJobOutput } from "@/lib/gallery/saveOutput";
export const POST = withWorkspaceRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { jobId, outputId } = body;
    if (!jobId || !outputId)
      return NextResponse.json(
        { success: false, error: "jobId and outputId are required" },
        { status: 400 },
      );
    const bucket = ["common", "draft", "upscale"].includes(body.bucket)
      ? body.bucket
      : "common";
    const result = await saveJobOutput(jobId, outputId, bucket);
    return NextResponse.json({
      success: true,
      alreadyInGallery: result.alreadySaved,
      asset: result.asset,
      bucket,
      autoTags: [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: /not found/.test(error.message) ? 404 : 500 },
    );
  }
}, "content");
