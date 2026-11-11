/** Identity metadata is captured at version creation, never reconstructed from later edits. */
export function serializeVersionIdentity(name: string, gender: string | null) {
  return JSON.stringify({ schemaVersion: 1, name, gender });
}
export function readVersionIdentity(raw: string | null | undefined): { name: string; gender: string | null } | null {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.schemaVersion !== 1 || typeof value.name !== "string" ||
        !(value.gender === null || typeof value.gender === "string")) return null;
    return { name: value.name, gender: value.gender };
  } catch { return null; }
}
