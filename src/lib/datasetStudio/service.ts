import { prisma } from "@/lib/prisma";
import { type Authority,digest,draftSchema,fail,findReceipt,parse,receipt } from "@/lib/mcp/core";
import { assertCredential } from "@/lib/mcp/auth";
import { assertModelAllowed } from "@/lib/mcp/operator-policy";
import { currentDependencies } from "@/lib/mcp/plans";
import { effectiveSettings,modelConfiguration } from "@/lib/mcp/catalog";
import { startGeneration,getBatch,cancelBatch } from "@/lib/mcp/batches";
import { downloadArtifact } from "@/lib/mcp/artifacts";
import { studioSubmit } from "./schema";
import type { z } from "zod";
export function bridgeEnabled() {
  return process.env.ENGUI_MCP_ENABLED==="1"&&process.env.ENGUI_DATASET_STUDIO_ENABLED==="1";
}
export async function capabilities() {
  await assertModelAllowed("krea2-turbo");
  const config=await modelConfiguration("krea2-turbo");
  return {version:1,ready:bridgeEnabled()&&config.configured,modelId:"krea2-turbo",
    workflow:"krea2-identity-v1.2",maxPixels:2*1024*1024,maxConcurrency:1,
    defaults:{steps:8,cfg:1,ref_boost:0.25,grounding_px:512,identity_strength:1},
    billing:"provider GPU time; no fixed per-image price",supports:["submit","status","cancel","original"],
    promptHandling:"literal; Studio composes the Krea prompt",referenceCount:1};
}
export async function submit(auth:Authority,input:z.infer<typeof studioSubmit>) {
  await assertCredential(auth.credentialId,auth.workspace.id);
  await assertModelAllowed("krea2-turbo");
  if(!bridgeEnabled()) fail("MODEL_UNAVAILABLE","Dataset Studio Identity Edit is not enabled.");
  const request={...input,credentialId:auth.credentialId};
  let prepared:any=await findReceipt("dataset-studio-prepare",input.requestKey,request);
  if(!prepared) {
    const draft=draftSchema.parse({modelId:"krea2-turbo",mode:"image_to_image",
      prompt:input.prompt,references:[input.source],width:input.width,height:input.height,
      variantCount:1,seeds:[input.seed],parameters:{steps:input.steps,cfg:1,denoise:1},
      loras:input.loras,requestKey:input.requestKey});
    const settings=effectiveSettings(draft),dependencies=await currentDependencies(draft);
    // Literal: Studio already composed this prompt; never expand braces/Vibes/Characters again.
    const snapshot={schemaVersion:2,draft,...dependencies,characterReferences:[],
      variants:[{index:0,label:"A",seed:input.seed,prompt:input.prompt,negativePrompt:"",
        settings:{...settings,seed:input.seed}}],
      stages:{basePrompt:input.prompt,identityPrompt:input.prompt,vibePrompt:input.prompt,
        expandedPrompt:input.prompt,characterMode:"plain",characterReferences:[],
        wildcardReplacements:[],wildcardSelections:[]},
      warnings:[],estimatedCost:null,costStatus:"unknown",
      datasetStudio:{version:1,workflow:"krea2-identity-v1.2",controls:input.identity,provenance:input.provenance}};
    prepared=await receipt("dataset-studio-prepare",input.requestKey,request,async tx=>{
      await assertCredential(auth.credentialId,auth.workspace.id,"generate",tx);
      const plan=await tx.mcpGenerationPlan.create({data:{workspaceId:auth.workspace.id,
        credentialId:auth.credentialId,inputDigest:digest(request),digest:digest(snapshot),
        snapshotJson:JSON.stringify(snapshot),expiresAt:new Date(Date.now()+86400000)}});
      return {planId:plan.id,planDigest:plan.digest};
    });
  }
  const batch=await startGeneration(auth,{...prepared,requestKey:input.requestKey});
  return {requestKey:input.requestKey,batchId:batch.batchId,jobId:batch.variants[0].jobId,accepted:true};
}
async function ownedBatch(auth:Authority,requestKey:string) {
  const row=await prisma.mcpOperationReceipt.findFirst({where:{workspaceId:auth.workspace.id,
    operation:"dataset-studio-prepare",requestKey}});
  if(!row||row.retiredAt) fail("NOT_FOUND","Dataset job not found.");
  const saved=parse(row.resultJson);
  const plan=await prisma.mcpGenerationPlan.findFirst({where:{id:saved.planId,credentialId:auth.credentialId}});
  if(!plan) fail("NOT_FOUND","Dataset job not found.");
  return prisma.mcpGenerationBatch.findFirst({where:{planId:plan.id,credentialId:auth.credentialId}});
}
export async function status(auth:Authority,requestKey:string) {
  const batch=await ownedBatch(auth,requestKey);
  if(!batch) return {requestKey,state:"prepared",phase:"prepared",isTerminal:false,pollAfterSeconds:2};
  const result=await getBatch(batch.id),v=result.variants[0];
  return {requestKey,batchId:batch.id,jobId:v.jobId,state:v.state,phase:v.phase,
    isTerminal:v.isTerminal,errorCode:v.errorCode,source:v.source,seed:v.seed,
    cancellationRequested:result.cancellationRequested,observedAt:result.observedAt,
    pollAfterSeconds:result.isTerminal?0:2};
}
export async function cancel(auth:Authority,requestKey:string,cancelKey:string) {
  const batch=await ownedBatch(auth,requestKey);
  if(!batch) fail("NOT_FOUND","No submitted dataset job. Resolve submit before cancelling.");
  await cancelBatch({batchId:batch.id,requestKey:cancelKey});
  return status(auth,requestKey);
}
export async function artifact(auth:Authority,requestKey:string,origin:string) {
  const current=await status(auth,requestKey);
  if(current.state!=="succeeded"||!("source" in current)||!current.source)
    fail("NOT_READY","Dataset result is not ready.");
  return downloadArtifact(auth,current.source as any,origin);
}
