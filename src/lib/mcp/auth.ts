import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { type Authority, fail } from "./core";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function validateHost(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const configured = (process.env.ENGUI_MCP_ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const loopback = /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host);
  if (!loopback && !configured.includes(host))
    throw new HttpError(403, "Host is not allowed.");
  if (
    !loopback &&
    url.protocol !== "https:" &&
    request.headers.get("x-forwarded-proto") !== "https"
  )
    throw new HttpError(403, "TLS is required.");
  const origin = request.headers.get("origin");
  const origins = (process.env.ENGUI_MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean);
  if (origin && origin !== url.origin && !origins.includes(origin))
    throw new HttpError(403, "Origin is not allowed.");
  if (url.search)
    throw new HttpError(400, "MCP does not accept query selectors.");
}
const hash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
// The only pre-scope database lookup: public credential ID, with no caller owner override.
export async function authenticate(request: Request): Promise<Authority> {
  validateHost(request);
  const m = /^Bearer (engui_mcp_([a-f0-9-]{36})\.([A-Za-z0-9_-]{43}))$/.exec(
    request.headers.get("authorization") || "",
  );
  if (!m) throw new HttpError(401, "A valid MCP credential is required.");
  const credential = await prisma.mcpCredential.findUnique({
    where: { id: m[2] },
  });
  if (
    !credential ||
    credential.revokedAt ||
    credential.expiresAt.getTime() <= Date.now() ||
    !timingSafeEqual(
      Buffer.from(credential.secretHash, "hex"),
      Buffer.from(hash(m[3]), "hex"),
    )
  )
    throw new HttpError(401, "A valid MCP credential is required.");
  const selected = request.headers.get("x-workspace-id");
  if (
    !selected ||
    !selected.trim() ||
    selected !== selected.trim() ||
    !/^[a-f0-9-]{36}$/i.test(selected)
  )
    throw new HttpError(400, "Exactly one workspace UUID header is required.");
  if (selected !== credential.workspaceId)
    throw new HttpError(403, "Credential workspace mismatch.");
  const ws = await prisma.workspace.findUnique({ where: { id: selected } });
  if (
    !ws ||
    ws.userId !== credential.ownerId ||
    credential.ownerId !== "user-with-settings"
  )
    throw new HttpError(404, "Workspace not found.");
  if (ws.lifecycle !== "active")
    throw new HttpError(409, "Workspace is unavailable.");
  return {
    credentialId: credential.id,
    ownerId: credential.ownerId,
    workspace: { id: ws.id, name: ws.name, revision: ws.revision },
    scopes: JSON.parse(credential.scopesJson),
  };
}
export async function assertCredential(
  id: string,
  workspaceId: string,
  scope = "generate",
  db: any = prisma,
) {
  const c = await db.mcpCredential.findFirst({ where: { id, workspaceId } });
  if (
    !c ||
    c.revokedAt ||
    c.expiresAt.getTime() <= Date.now() ||
    !JSON.parse(c.scopesJson).includes(scope)
  )
    fail(
      "WORKSPACE_UNAVAILABLE",
      "Credential is expired, revoked or not authorized.",
    );
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.lifecycle !== "active" || ws.userId !== c.ownerId)
    fail("WORKSPACE_UNAVAILABLE", "Workspace is unavailable.");
}
export function inAuthority<T>(auth: Authority, work: () => T): T {
  return workspaceContext.run(
    {
      kind: "workspace",
      workspaceId: auth.workspace.id,
      userId: auth.ownerId,
      revision: auth.workspace.revision,
    },
    work,
  );
}
export async function provisionCredential(
  workspaceId: string,
  scopes: string[],
  days: number,
) {
  if (
    !scopes.includes("read") ||
    scopes.some((s) => !["read", "generate", "curate", "cancel"].includes(s)) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    throw Error(
      "Choose explicit scopes including read and expiry of 1–365 days.",
    );
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.lifecycle !== "active" || ws.userId !== "user-with-settings")
    throw Error("Active owned workspace required.");
  const id = randomUUID(),
    secret = randomBytes(32).toString("base64url");
  await workspaceContext.run({ kind: "workspace", workspaceId }, () =>
    prisma.mcpCredential.create({
      data: {
        id,
        workspaceId,
        ownerId: ws.userId,
        secretHash: hash(secret),
        scopesJson: JSON.stringify([...new Set(scopes)]),
        expiresAt: new Date(Date.now() + days * 86400000),
      },
    }),
  );
  return { id, token: `engui_mcp_${id}.${secret}` };
}
