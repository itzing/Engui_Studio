import { z } from "zod";
import { REGIONS } from "@/lib/looks/parts";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const requestKey = z.string().uuid();
const editRevision = z.string().regex(/^[a-f0-9]{64}$/);
const name = z.string().trim().min(1).max(180);
const gender = z.enum(["male", "female"]).nullable();
const traitKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/)
  .refine((key) => !["__proto__", "prototype", "constructor"].includes(key));
const text = z.string().trim().min(1).max(3000);
const traits = z.record(traitKey, text).refine((v) => Object.keys(v).length <= 160);
const traitPatch = z.record(traitKey, text.nullable()).refine((v) => Object.keys(v).length <= 160);
export const visibleParts = z.array(z.object({
  region: z.enum(REGIONS), text, exposed: z.boolean().optional(),
}).strict()).max(100);
const summary = z.string().trim().max(2000).optional();
const page = { cursor: z.string().max(2048).optional(), limit: z.number().int().min(1).max(50).default(20) };
const outfitPatch = z.object({
  name: name.optional(), description: z.string().trim().min(1).max(20000).optional(),
  constraints: z.string().trim().max(10000).optional(), coversFace: z.boolean().optional(),
  visibleParts: visibleParts.nullable().optional(),
}).strict();
export const authoringInputSchemas = {
  engui_create_character: z.object({ name, gender: gender.default(null), traits: traits.default({}),
    identityParts: visibleParts.nullable().optional(), changeSummary: summary, requestKey }).strict(),
  engui_update_character: z.object({ characterId: id, expectedRevision: editRevision, requestKey,
    changes: z.object({ name: name.optional(), gender: gender.optional(), traits: traitPatch.optional(),
      identityParts: visibleParts.nullable().optional() }).strict(), changeSummary: summary }).strict(),
  engui_list_character_versions: z.object({ characterId: id, ...page }).strict(),
  engui_get_outfit: z.object({ outfitId: id }).strict(),
  engui_create_outfit: z.object({ name, description: z.string().trim().min(1).max(20000),
    constraints: z.string().trim().max(10000).default(""), coversFace: z.boolean().default(false),
    ownerCharacterId: id.optional(), visibleParts: visibleParts.nullable().optional(), requestKey }).strict(),
  engui_update_outfit: z.object({ outfitId: id, expectedRevision: z.number().int().positive(),
    changes: outfitPatch, requestKey }).strict(),
  engui_get_wardrobe: z.object({ characterId: id, ...page }).strict(),
  engui_update_wardrobe: z.object({ characterId: id, expectedRevision: editRevision,
    action: z.enum(["link", "default", "unlink", "clearDefault"]), outfitId: id.optional(), requestKey }).strict(),
};
