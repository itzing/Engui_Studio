import fs from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { provisionCredential } from "../../src/lib/mcp/auth";
import { workspaceContext } from "../../src/lib/workspaces/context";
async function main() {
  const [action, workspaceId, value, days = "30", output] =
    process.argv.slice(2);
  if (!workspaceId || !["create", "revoke", "list"].includes(action))
    throw Error(
      "Usage: credentials.ts create <workspaceId> <read,generate,curate,cancel> [days] [private-output-file] | revoke <workspaceId> <tokenId> | list <workspaceId>",
    );
  if (action === "create") {
    if (output && fs.existsSync(output))
      throw Error("Output file already exists.");
    const credential = await provisionCredential(
      workspaceId,
      (value || "read").split(","),
      Number(days),
    );
    if (output) {
      fs.writeFileSync(output, credential.token + "\n", {
        mode: 0o600,
        flag: "wx",
      });
      console.log(JSON.stringify({ id: credential.id, secretWritten: true }));
    } else process.stdout.write(credential.token + "\n");
  } else
    await workspaceContext.run({ kind: "workspace", workspaceId }, async () => {
      if (action === "revoke") {
        const r = await prisma.mcpCredential.updateMany({
          where: { id: value, workspaceId },
          data: { revokedAt: new Date() },
        });
        if (!r.count) throw Error("Credential not found.");
        console.log("Credential revoked; queued dispatch will stop.");
      } else
        console.log(
          JSON.stringify(
            await prisma.mcpCredential.findMany({
              where: { workspaceId },
              select: {
                id: true,
                scopesJson: true,
                expiresAt: true,
                revokedAt: true,
                createdAt: true,
              },
            }),
            null,
            2,
          ),
        );
    });
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
