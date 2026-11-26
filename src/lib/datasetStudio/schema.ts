import { z } from "zod";
import { mediaRef, uploadInput, draftSchema } from "@/lib/mcp/core";
export const studioSource = z.union([mediaRef,
  z.object({kind:z.literal("dataset_upload"),uploadId:z.string().uuid()}).strict()]);
export const studioDraft = draftSchema.extend({references:z.array(studioSource).max(2).default([])});
export const identityControls = z.object({
  ref_boost:z.number().finite().min(0).max(10).default(0.25),
  grounding_px:z.number().int().min(512).max(1536).default(512),
  identity_strength:z.number().finite().min(0).max(1.5).default(1),
}).strict();
export type IdentityControls=z.infer<typeof identityControls>;
const provenance=z.object({
  datasetId:z.string().min(1).max(128),candidateId:z.string().min(1).max(128),
  cardLabel:z.string().max(120).optional(),subjectType:z.string().max(32).optional(),
  upstreamVersion:z.string().max(64).optional(),
}).strict();
export const studioSubmit=z.object({
  requestKey:z.string().uuid(),source:studioSource,prompt:z.string().min(1).max(16000),
  seed:z.number().int().min(0).max(2147483647),
  width:z.number().int().min(512).max(2048).multipleOf(64),
  height:z.number().int().min(512).max(2048).multipleOf(64),
  steps:z.number().int().min(1).max(50).default(8),
  identity:identityControls.default({}),loras:draftSchema.shape.loras,provenance,
}).strict().refine(v=>v.width*v.height<=2*1024*1024,"Identity Edit supports at most 2 MP");
export const studioAction=z.discriminatedUnion("action",[
  z.object({action:z.literal("capabilities")}).strict(),
  z.object({action:z.literal("create_upload"),input:uploadInput}).strict(),
  z.object({action:z.literal("get_upload"),uploadId:z.string().uuid()}).strict(),
  z.object({action:z.literal("submit"),input:studioSubmit}).strict(),
  z.object({action:z.literal("status"),requestKey:z.string().uuid()}).strict(),
  z.object({action:z.literal("cancel"),requestKey:z.string().uuid(),cancelKey:z.string().uuid()}).strict(),
  z.object({action:z.literal("artifact"),requestKey:z.string().uuid()}).strict(),
]);
export const identitySnapshot=z.object({
  version:z.literal(1),workflow:z.literal("krea2-identity-v1.2"),controls:identityControls,provenance,
}).strict();
