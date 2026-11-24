import { prisma } from "@/lib/prisma";
import { deleteFinishedJob } from "@/lib/jobManagement";
import { findReceipt, receipt, McpError } from "./core";
export async function deleteJob(args: {jobId:string; requestKey:string}) {
  const previous=await findReceipt("delete_job",args.requestKey,args);
  if(previous)return previous;
  const job=await prisma.job.findFirst({where:{id:args.jobId}});
  let result:{deletedJobId:string;alreadyAbsent:boolean};
  if(!job)result={deletedJobId:args.jobId,alreadyAbsent:true};
  else {
    try { await deleteFinishedJob(job); }
    catch(error:any) {
      if(error?.code!=="P2025") {
        if(error?.status===409 || /cancel it first|reconciliation|preservation|materialization/.test(error?.message||""))
          throw new McpError("JOB_BUSY",error.message,true);
        throw error;
      }
    }
    result={deletedJobId:args.jobId,alreadyAbsent:false};
  }
  // File cleanup is outside the DB transaction. A crash/retry sees an absent Job,
  // while retained batch/variant/start receipts prevent a second generation.
  return receipt("delete_job",args.requestKey,args,async()=>result);
}
