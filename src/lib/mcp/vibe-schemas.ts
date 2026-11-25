import { z } from "zod";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const requestKey = z.string().uuid();
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const fields = {
  name: z.string().trim().min(1).max(180),
  baseDescription: z.string().trim().min(1).max(16000),
  tags: z.array(z.string().trim().min(1).max(100)).max(50),
  compatibleSceneTypes: z.array(z.string().trim().min(1).max(100)).max(50),
};
const target = { vibeId: id, expectedRevision: revision, requestKey };
export const vibeInputSchemas = {
  engui_list_vibes: z.object({ query: z.string().max(256).optional(), status: z.enum(["active", "trash"]).default("active"), cursor: z.string().max(2048).optional(), limit: z.number().int().min(1).max(50).default(20) }).strict(),
  engui_get_vibe: z.object({ vibeId: id }).strict(),
  engui_create_vibe: z.object({ ...fields, tags: fields.tags.default([]), compatibleSceneTypes: fields.compatibleSceneTypes.default([]), requestKey }).strict(),
  engui_update_vibe: z.object({ ...target, changes: z.object(fields).partial().strict().refine(v => Object.keys(v).length > 0, "Supply at least one change") }).strict(),
  engui_delete_vibe: z.object(target).strict(),
  engui_restore_vibe: z.object(target).strict(),
};
