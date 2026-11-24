import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { Readable } from "node:stream";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { localContentPath } from "@/lib/workspaces/files";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { authenticate, HttpError, inAuthority, validateHost } from "./auth";
import { type Authority, type MediaRef, fail, limits, mediaRef, McpError, rateLimit } from "./core";
import { resolveMedia } from "./media";

const payloadSchema = z.object({
  v: z.literal(1), credentialId: z.string().uuid(), workspaceId: z.string().uuid(),
  source: mediaRef, sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expires: z.number().int().positive(),
}).strict();
const tokenPattern = /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/;
const mimeTypes: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
};
function signature(encoded: string, secretHash: string) {
  return createHmac("sha256", Buffer.from(secretHash, "hex")).update("engui-artifact-v1:" + encoded).digest();
}
async function credentialAuthority(id: string, workspaceId: string) {
  // Same narrow pre-scope credential lookup as MCP authentication. The URL is a
  // short-lived capability, NOT the user's long-lived MCP bearer credential.
  const c = await prisma.mcpCredential.findUnique({ where: { id } });
  if (!c || c.workspaceId !== workspaceId || c.ownerId !== "user-with-settings" || c.revokedAt || c.expiresAt.getTime() <= Date.now() || !JSON.parse(c.scopesJson).includes("read"))
    throw new HttpError(401, "Download link is invalid or expired.");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.userId !== c.ownerId || ws.lifecycle !== "active") throw new HttpError(404, "Artifact is unavailable.");
  return { credential: c, auth: { credentialId: c.id, ownerId: c.ownerId, workspace: { id: ws.id, name: ws.name, revision: ws.revision }, scopes: JSON.parse(c.scopesJson) } as Authority };
}
async function openOriginal(source: MediaRef) {
  const workspaceId = requireWorkspaceId(), resolved = await resolveMedia(source, true);
  // Records choose the resource; no caller-supplied path or remote fetch.
  if (/[%\\?#]/.test(resolved.url) || resolved.url.split("/").some(p => p === "." || p === "..") || !resolved.url.startsWith("/"))
    fail("MEDIA_UNAVAILABLE", "Original is not available in local storage.");
  const local = localContentPath(resolved.url);
  if (!local) fail("MEDIA_UNAVAILABLE", "Original is not available in local storage.");
  const galleryScope = /^\/generations\/gallery\/([^/]+)\//.exec(resolved.url);
  if (galleryScope && galleryScope[1] !== workspaceId) fail("NOT_FOUND", "Artifact not found.");
  const foreign = await prisma.workspaceFile.findFirst({ where: { location: resolved.url, storageTarget: "local", workspaceId: { not: workspaceId } } });
  if (foreign) fail("NOT_FOUND", "Artifact not found.");
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const root = await fs.realpath(path.resolve(process.cwd(), "public"));
    const real = await fs.realpath(local);
    if (!real.startsWith(root + path.sep) || (await fs.lstat(local)).isSymbolicLink()) fail("MEDIA_UNAVAILABLE", "Original bytes are unavailable.");
    handle = await fs.open(real, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size < 1) fail("MEDIA_UNAVAILABLE", "Original bytes are unavailable.");
    // Hash incrementally without loading large originals/videos into the MCP JSON response.
    const hash = createHash("sha256");
    for await (const chunk of handle.createReadStream({ start: 0, end: stat.size - 1, autoClose: false })) hash.update(chunk);
    const sha256 = hash.digest("hex"), after = await handle.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || (resolved.expectedHash && resolved.expectedHash !== sha256))
      fail("MEDIA_UNAVAILABLE", "Original image integrity check failed.");
    const ext = path.extname(real).toLowerCase();
    const stem = source.kind === "job_output" ? `job-${source.jobId}-${source.outputId}` : `asset-${source.assetId}`;
    return { handle, byteLength: stat.size, sha256, mimeType: mimeTypes[ext] || "application/octet-stream", filename: stem + (/^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ".bin") };
  } catch (error) {
    await handle?.close();
    if (error instanceof McpError) throw error;
    fail("MEDIA_UNAVAILABLE", "Original bytes are unavailable.");
  }
}
export async function downloadArtifact(auth: Authority, source: MediaRef, origin: string) {
  const { credential } = await credentialAuthority(auth.credentialId, auth.workspace.id);
  const file = await openOriginal(source);
  await file.handle.close();
  const expires = Math.floor(Math.min(Date.now() + limits().artifactLinkTtlSeconds * 1000, credential.expiresAt.getTime()) / 1000);
  const payload = { v: 1, credentialId: auth.credentialId, workspaceId: auth.workspace.id, source, sha256: file.sha256, byteLength: file.byteLength, expires };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = encoded + "." + signature(encoded, credential.secretHash).toString("base64url");
  return { source, filename: file.filename, mimeType: file.mimeType, byteLength: file.byteLength, sha256: file.sha256,
    downloadUrl: new URL("/api/mcp/artifacts/" + token, origin).href, expiresAt: new Date(expires * 1000).toISOString(), original: true as const };
}
export async function handleArtifactRequest(request: Request, token: string): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  try {
    if (process.env.ENGUI_MCP_ENABLED !== "1") throw new HttpError(404, "Not found.");
    validateHost(request);
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    if (!tokenPattern.test(token)) throw new HttpError(401, "Download link is invalid or expired.");
    const [encoded, mac] = token.split(".");
    let payload: z.infer<typeof payloadSchema>;
    try { payload = payloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString())); }
    catch { throw new HttpError(401, "Download link is invalid or expired."); }
    const { credential, auth } = await credentialAuthority(payload.credentialId, payload.workspaceId);
    if (payload.expires * 1000 <= Date.now() || payload.expires * 1000 > Date.now() + limits().artifactLinkTtlSeconds * 1000 || !timingSafeEqual(signature(encoded, credential.secretHash), Buffer.from(mac, "base64url")))
      throw new HttpError(401, "Download link is invalid or expired.");
    // If a client explicitly supplies MCP authority headers they must agree with
    // the capability. Bare GET needs only this one short-lived exact-file URL.
    if (request.headers.has("authorization") || request.headers.has("x-workspace-id")) {
      const provided = await authenticate(request);
      if (provided.credentialId !== auth.credentialId || provided.workspace.id !== auth.workspace.id) throw new HttpError(403, "Credential workspace mismatch.");
    }
    return await inAuthority(auth, async () => {
      await rateLimit(auth, "engui_download_artifact");
      const file = await openOriginal(payload.source);
      if (file.sha256 !== payload.sha256 || file.byteLength !== payload.byteLength) { await file.handle.close(); throw new HttpError(409, "Original changed. Request a fresh download link."); }
      const out = { ...headers, "Content-Type": file.mimeType, "Content-Length": String(file.byteLength), "Content-Disposition": `attachment; filename="${file.filename}"`, ETag: `"${file.sha256}"` };
      if (request.method === "HEAD") { await file.handle.close(); return new Response(null, { headers: out }); }
      const stream = file.handle.createReadStream({ start: 0, end: file.byteLength - 1, autoClose: true });
      // Cancelled clients close the descriptor instead of leaving an orphaned read.
      const abort = () => stream.destroy();
      request.signal.addEventListener("abort", abort, { once: true });
      stream.once("close", () => request.signal.removeEventListener("abort", abort));
      if (request.signal.aborted) stream.destroy();
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: out });
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof McpError ? (error.code === "RATE_LIMITED" ? 429 : error.code === "NOT_FOUND" ? 404 : 409) : 500;
    return Response.json({ error: error instanceof HttpError || error instanceof McpError ? error.message : "Artifact is unavailable." }, { status, headers });
  }
}
