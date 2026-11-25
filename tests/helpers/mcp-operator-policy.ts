import { beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Adapter regressions explicitly approve synthetic models; never inherit the operator's production file.
export function installMcpTestPolicy() {
  let directory: string, previous: string | undefined;
  beforeAll(async () => {
    if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required");
    previous = process.env.ENGUI_MCP_POLICY_PATH;
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "engui-mcp-policy-test-"));
    const filename = path.join(directory, "policy.json");
    await fs.writeFile(filename, JSON.stringify({ enabledModels: ["krea2-turbo", "z-image", "qwen-image-edit", "qwen-image-edit-maskflow"], workspacePreferences: {} }));
    process.env.ENGUI_MCP_POLICY_PATH = filename;
  });
  afterAll(async () => {
    if (previous === undefined) delete process.env.ENGUI_MCP_POLICY_PATH; else process.env.ENGUI_MCP_POLICY_PATH = previous;
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });
}
