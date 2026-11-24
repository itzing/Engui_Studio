import { prisma } from "@/lib/prisma";
import { UNKNOWN_STOP_CODE, UNKNOWN_STOP_MESSAGE } from "./jobControl";
export class JobControlError extends Error {
  readonly status = 409;
}
// Call inside a workspace-scoped transaction. Keep variant/plan/receipt tombstones.
export async function stopUnknownJobInTransaction(jobId: string, tx: any) {
  const job = await tx.job.findFirst({where:{id:jobId}});
  const variant = await tx.mcpGenerationVariant.findFirst({where:{jobId}});
  const card = await tx.cardBatchTask.findFirst({where:{jobId}});
  if (variant?.state === "abandoned" || card?.state === "abandoned") return {job, locallyStopped:true};
  if (job && ["completed", "cancelled", "canceled"].includes(job.status)) return null;
  if (job?.runpodJobId || variant?.providerJobId || card?.providerJobId) return null;
  if (job?.status !== "submission_unknown" && variant?.state !== "submission_unknown" && card?.state !== "submission_unknown") return null;
  if ([variant,card].some(v=>v?.leaseUntil && v.leaseUntil.getTime()>Date.now()))
    throw new JobControlError("Submission is still settling. Wait for the active dispatch lease to finish, then stop or delete this job.");
  if (variant) await tx.mcpGenerationVariant.update({where:{id:variant.id},data:{state:"abandoned",errorCode:UNKNOWN_STOP_CODE,leaseUntil:null}});
  if (card) await tx.cardBatchTask.update({where:{id:card.id},data:{state:"abandoned",error:UNKNOWN_STOP_MESSAGE,leaseUntil:null}});
  const stopped = job ? await tx.job.update({where:{id:jobId},data:{status:"failed",error:UNKNOWN_STOP_MESSAGE,completedAt:new Date()}}) : null;
  return {job:stopped,locallyStopped:true};
}
export async function stopUnknownJob(jobId: string) {
  return prisma.$transaction(tx=>stopUnknownJobInTransaction(jobId,tx));
}
export async function settleCancelledUnknownBatch(batchId: string) {
  return prisma.$transaction(async tx=>{
    const batch=await tx.mcpGenerationBatch.findFirst({where:{id:batchId}});
    if(!batch?.cancelledAt) return [] as string[];
    const variants=await tx.mcpGenerationVariant.findMany({where:{batchId,state:"submission_unknown"}});
    const stopped:string[]=[];
    for(const v of variants){
      try { if(await stopUnknownJobInTransaction(v.jobId,tx)) stopped.push(v.jobId); }
      catch(e){if(!(e instanceof JobControlError))throw e;}
    }
    return stopped;
  });
}
