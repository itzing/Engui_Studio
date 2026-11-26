import { authenticate,HttpError,inAuthority } from "@/lib/mcp/auth";
import { McpError,rateLimit } from "@/lib/mcp/core";
import { createUpload,getUpload } from "@/lib/mcp/uploads";
import { studioAction } from "@/lib/datasetStudio/schema";
import * as studio from "@/lib/datasetStudio/service";
import { WorkspaceError } from "@/lib/workspaces/context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request) {
  try {
    if(!studio.bridgeEnabled()) throw new HttpError(404,"Not found.");
    const auth=await authenticate(request);
    if(!request.body) throw new HttpError(400,"Request body is required.");
    const reader=request.body.getReader(), chunks:Uint8Array[]=[];
    let size=0;
    const deadline=AbortSignal.timeout(30000);
    const timeout=new Promise<never>((_,reject)=>deadline.addEventListener("abort",()=>{
      void reader.cancel().catch(()=>undefined); reject(new HttpError(408,"Request timed out."));
    },{once:true}));
    try {
      for(;;) {
        const part=await Promise.race([reader.read(),timeout]);
        if(part.done) break;
        size+=part.value.byteLength;
        if(size>100000) throw new HttpError(413,"Request is too large.");
        chunks.push(part.value);
      }
    } finally { void reader.cancel().catch(()=>undefined); reader.releaseLock(); }
    const raw=Buffer.concat(chunks).toString("utf8");
    const decoded=studioAction.safeParse(JSON.parse(raw));
    if(!decoded.success) throw new HttpError(400,"Invalid Dataset Studio request.");
    const args=decoded.data;
    const scope=["create_upload","get_upload","submit"].includes(args.action)?"generate":args.action==="cancel"?"cancel":"read";
    if(!auth.scopes.includes(scope)) throw new HttpError(403,"Credential scope is required: "+scope);
    return await inAuthority(auth,async()=>{
      await rateLimit(auth,args.action==="submit"?"engui_prepare_generation":args.action==="cancel"?"engui_cancel_batch":"engui_get_context");
      const url=new URL(request.url);
      // authenticate() has already validated Host/TLS; match the MCP signed-link origin.
      const origin=`${request.headers.get("x-forwarded-proto")==="https"?"https:":url.protocol}//${request.headers.get("host")||url.host}`;
      let data;
      switch(args.action) {
        case "capabilities":data=await studio.capabilities();break;
        case "create_upload":data=await createUpload(auth,args.input,origin,"dataset-studio");break;
        case "get_upload":data=await getUpload(auth,args.uploadId,"dataset-studio");break;
        case "submit":data=await studio.submit(auth,args.input);break;
        case "status":data=await studio.status(auth,args.requestKey);break;
        case "cancel":data=await studio.cancel(auth,args.requestKey,args.cancelKey);break;
        case "artifact":data=await studio.artifact(auth,args.requestKey,origin);break;
      }
      return Response.json(data,{headers});
    });
  } catch(error) {
    const known=error instanceof HttpError||error instanceof McpError||error instanceof WorkspaceError;
    const status=error instanceof HttpError?error.status:error instanceof SyntaxError?400:
      error instanceof McpError?(error.code==="NOT_FOUND"?404:error.code==="RATE_LIMITED"?429:409):
      error instanceof WorkspaceError?409:500;
    return Response.json({error:known?error.message:"Dataset operation could not be completed.",
      code:error instanceof McpError?error.code:"REQUEST_FAILED"},{status,headers});
  }
}
