import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registerWorkspaceFile } from "@/lib/workspaces/files";
import { withWorkspaceActivity } from "@/lib/workspaces/activity";
import { WorkspaceError } from "@/lib/workspaces/context";
import { authenticate, assertCredential, HttpError, inAuthority, validateHost } from "./auth";
import { type Authority, fail, limits, McpError, parse, rateLimit, receipt, uploadInput } from "./core";
import { readMedia } from "./media";

type UploadInput = z.infer<typeof uploadInput>;
const tokenPattern = /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/;
const payloadSchema = z.object({ v: z.literal(1), credentialId: z.string().uuid(), workspaceId: z.string().uuid(), uploadId: z.string().uuid(), expires: z.number().int().positive() }).strict();
const signature = (encoded: string, secret: string) => createHmac("sha256", Buffer.from(secret, "hex")).update("engui-upload-v1:" + encoded).digest();
let activeUploads = 0;

async function authority(credentialId: string, workspaceId: string) {
  const c = await prisma.mcpCredential.findUnique({ where: { id: credentialId } });
  if (!c || c.workspaceId !== workspaceId || c.ownerId !== "user-with-settings" || c.revokedAt || c.expiresAt.getTime() <= Date.now() || !JSON.parse(c.scopesJson).includes("generate"))
    throw new HttpError(401, "Upload link is invalid or expired.");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.userId !== c.ownerId || ws.lifecycle !== "active") throw new HttpError(409, "Workspace is unavailable.");
  return { credential: c, auth: { credentialId: c.id, ownerId: c.ownerId, workspace: { id: ws.id, name: ws.name, revision: ws.revision }, scopes: JSON.parse(c.scopesJson) } as Authority };
}
async function ticket(auth: Authority, uploadId: string) {
  const row = await prisma.mcpOperationReceipt.findFirst({ where: { workspaceId: auth.workspace.id, operation: "upload-create", requestKey: uploadId } });
  const value = parse(row?.resultJson);
  if (!row || row.retiredAt || value.credentialId !== auth.credentialId) fail("NOT_FOUND", "Upload not found.");
  return uploadInput.parse(value.descriptor);
}
export async function getUpload(auth: Authority, uploadId: string) {
  const descriptor = await ticket(auth, uploadId);
  const row = await prisma.mcpOperationReceipt.findFirst({ where: { workspaceId: auth.workspace.id, operation: "upload-file", requestKey: uploadId } });
  const base = { uploadId, filename: descriptor.filename, mimeType: descriptor.mimeType, byteLength: descriptor.byteLength, sha256: descriptor.sha256 };
  if (!row) return { ...base, status: "pending", source: null, width: null, height: null };
  if (row.retiredAt) fail("OPERATION_RETIRED", "Upload has been removed.");
  const result = parse(row.resultJson);
  // A completed receipt never resurrects a deleted/trashed or modified original.
  const image = await readMedia(result.source);
  if (image.hash !== descriptor.sha256) fail("MEDIA_UNAVAILABLE", "Uploaded image has changed.");
  return { ...base, status: "ready", source: result.source, width: image.width, height: image.height };
}
export async function createUpload(auth: Authority, args: UploadInput, origin: string) {
  const { credential } = await authority(auth.credentialId, auth.workspace.id);
  await receipt("upload-create", args.requestKey, { ...args, credentialId: auth.credentialId }, async () => ({ credentialId: auth.credentialId, descriptor: args }));
  const result = await getUpload(auth, args.requestKey);
  if (result.status === "ready") return { ...result, uploadUrl: null, expiresAt: null, method: "PUT", contentType: args.mimeType };
  const expires = Math.floor(Math.min(Date.now() + limits().uploadLinkTtlSeconds * 1000, credential.expiresAt.getTime()) / 1000);
  const encoded = Buffer.from(JSON.stringify({ v: 1, credentialId: auth.credentialId, workspaceId: auth.workspace.id, uploadId: args.requestKey, expires })).toString("base64url");
  const token = encoded + "." + signature(encoded, credential.secretHash).toString("base64url");
  return { ...result, uploadUrl: new URL("/api/mcp/uploads/" + token, origin).href, expiresAt: new Date(expires * 1000).toISOString(), method: "PUT", contentType: args.mimeType };
}
async function readBody(request: Request, descriptor: UploadInput) {
  if (request.headers.has("content-encoding")) throw new HttpError(415, "Encoded upload bodies are not supported.");
  const mime = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mime !== descriptor.mimeType && mime !== "application/octet-stream") throw new HttpError(415, "Send raw image bytes using the declared image MIME type.");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) !== descriptor.byteLength)) throw new HttpError(400, "Upload length does not match its declaration.");
  if (!request.body) throw new HttpError(400, "Image bytes are required.");
  const reader = request.body.getReader(), chunks: Buffer[] = [];
  let size = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new HttpError(408, "Upload timed out.")); }, 30000); timer.unref?.(); });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > descriptor.byteLength || size > limits().maxImageBytes) throw new HttpError(413, "Upload exceeds its declared size or the 25 MiB limit.");
      chunks.push(Buffer.from(next.value));
    }
  } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  if (request.signal.aborted || size !== descriptor.byteLength) throw new HttpError(400, "Upload is incomplete.");
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) throw new HttpError(400, "Upload SHA-256 does not match.");
  return bytes;
}
async function validateImage(bytes: Buffer, descriptor: UploadInput) {
  try {
    const decoder = sharp(bytes, { limitInputPixels: limits().maxImagePixels, failOn: "warning" });
    const meta = await decoder.metadata();
    const mime = meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`;
    if (!meta.width || !meta.height || !["png", "jpeg", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1 || mime !== descriptor.mimeType)
      throw Error("Unsupported image");
    await decoder.stats();
    return { width: meta.width, height: meta.height };
  } catch { throw new HttpError(415, "Upload must be a decodable static PNG, JPEG or WebP matching its MIME type, at most 40 megapixels."); }
}
async function storeImage(auth: Authority, descriptor: UploadInput, bytes: Buffer) {
  const ext = descriptor.mimeType === "image/jpeg" ? "jpg" : descriptor.mimeType === "image/webp" ? "webp" : "png";
  const url = `/uploads/mcp/${auth.workspace.id}/${descriptor.requestKey}.${ext}`;
  const file = path.join(process.cwd(), "public", url), dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const root = await fs.realpath(path.join(process.cwd(), "public"));
  if (!(await fs.realpath(dir)).startsWith(root + path.sep)) fail("MEDIA_UNAVAILABLE", "Upload storage is unavailable.");
  // Register first, so workspace removal also collects interrupted writes. Original
  // filenames are metadata only; only generated UUIDs determine storage paths.
  await registerWorkspaceFile(file);
  const temp = path.join(dir, "." + randomUUID() + ".tmp");
  await registerWorkspaceFile(temp);
  try {
    await fs.writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await fs.link(temp, file).catch(error => { if (error.code !== "EEXIST") throw error; });
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== bytes.length) fail("MEDIA_UNAVAILABLE", "Upload storage integrity check failed.");
      const stored = await handle.readFile();
      if (createHash("sha256").update(stored).digest("hex") !== descriptor.sha256) fail("MEDIA_UNAVAILABLE", "Upload storage integrity check failed.");
    } finally { await handle.close(); }
  } finally {
    await fs.unlink(temp).catch(error => { if (error.code !== "ENOENT") throw error; });
    await prisma.workspaceFile.deleteMany({ where: { workspaceId: auth.workspace.id, location: "/" + path.relative(path.join(process.cwd(), "public"), temp).split(path.sep).join("/"), storageTarget: "local" } });
  }
  await receipt("upload-file", descriptor.requestKey, { ...descriptor, credentialId: auth.credentialId }, async tx => {
    await assertCredential(auth.credentialId, auth.workspace.id, "generate", tx);
    const asset = await tx.galleryAsset.create({ data: {
      workspaceId: auth.workspace.id, type: "image", bucket: "draft", originKind: "import",
      membershipKey: "mcp-upload:" + descriptor.requestKey, contentHash: descriptor.sha256,
      originalUrl: url, previewUrl: url, enrichmentStatus: "skipped", derivativeStatus: "pending",
      generationSnapshot: JSON.stringify({ imported: true, filename: descriptor.filename, mimeType: descriptor.mimeType }),
    } });
    return { source: { kind: "gallery_asset", assetId: asset.id } };
  });
}
export async function handleUploadRequest(request: Request, token: string): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  try {
    if (process.env.ENGUI_MCP_ENABLED !== "1") throw new HttpError(404, "Not found.");
    validateHost(request);
    if (request.method !== "PUT") return new Response(null, { status: 405, headers: { ...headers, Allow: "PUT" } });
    if (!tokenPattern.test(token)) throw new HttpError(401, "Upload link is invalid or expired.");
    const [encoded, mac] = token.split(".");
    let payload: z.infer<typeof payloadSchema>;
    try { payload = payloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString())); }
    catch { throw new HttpError(401, "Upload link is invalid or expired."); }
    const { credential, auth } = await authority(payload.credentialId, payload.workspaceId);
    if (payload.expires * 1000 <= Date.now() || payload.expires * 1000 > Date.now() + limits().uploadLinkTtlSeconds * 1000 || !timingSafeEqual(signature(encoded, credential.secretHash), Buffer.from(mac, "base64url"))) throw new HttpError(401, "Upload link is invalid or expired.");
    if (request.headers.has("authorization") || request.headers.has("x-workspace-id")) {
      const provided = await authenticate(request);
      if (provided.credentialId !== auth.credentialId || provided.workspace.id !== auth.workspace.id) throw new HttpError(403, "Credential workspace mismatch.");
    }
    return await inAuthority(auth, async () => {
      await rateLimit(auth, "engui_create_upload");
      if (activeUploads >= 4) throw new HttpError(503, "Upload service is busy. Retry with the same upload ID.");
      activeUploads++;
      try {
        return await withWorkspaceActivity(auth.workspace.id, "mcp-upload", async () => {
          const descriptor = await ticket(auth, payload.uploadId);
          const bytes = await readBody(request, descriptor);
          await validateImage(bytes, descriptor);
          await assertCredential(auth.credentialId, auth.workspace.id);
          const existing = await getUpload(auth, payload.uploadId);
          if (existing.status !== "ready") await storeImage(auth, descriptor, bytes);
          return Response.json(await getUpload(auth, payload.uploadId), { headers });
        });
      } finally { activeUploads--; }
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof WorkspaceError ? 409 : error instanceof McpError ? (error.code === "RATE_LIMITED" ? 429 : error.code === "NOT_FOUND" ? 404 : 409) : 500;
    return Response.json({ error: error instanceof HttpError || error instanceof McpError || error instanceof WorkspaceError ? error.message : "Upload could not be completed. Check engui_get_upload before retrying." }, { status, headers });
  }
}
