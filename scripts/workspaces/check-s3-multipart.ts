import { randomUUID, createHash } from 'node:crypto';
import { storageTarget } from '../../src/lib/workspaces/storage';
import { prisma } from '../../src/lib/prisma';
import { CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, HeadObjectCommand, DeleteObjectCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
async function main() {
 if(process.env.ENGUI_ALLOW_STORAGE_FIXTURE!=='1')throw new Error('Explicit ENGUI_ALLOW_STORAGE_FIXTURE=1 is required.');
 const target = await storageTarget();
 const owner = 'verification-' + randomUUID();
 const key = 'loras/workspaces/' + owner + '/multipart-probe.safetensors';
 const body=Buffer.from('Engui workspace multipart compatibility fixture\n');
 let uploadId:string|undefined; let completed=false;
 console.log(JSON.stringify({phase:'intent',key,bytes:body.length}));
 try {
  const created=await target.client.send(new CreateMultipartUploadCommand({Bucket:target.bucketName,Key:key,Metadata:{'engui-upload-owner':owner,'engui-upload-id':owner}}));
  uploadId=created.UploadId;if(!uploadId)throw new Error('Missing UploadId');
  const part=await target.client.send(new UploadPartCommand({Bucket:target.bucketName,Key:key,UploadId:uploadId,PartNumber:1,Body:body,ContentLength:body.length}));
  const parts=await target.client.send(new ListPartsCommand({Bucket:target.bucketName,Key:key,UploadId:uploadId}));
  if(parts.Parts?.[0]?.Size!==body.length)throw new Error('Part size mismatch');
  const completion=await target.client.send(new CompleteMultipartUploadCommand({Bucket:target.bucketName,Key:key,UploadId:uploadId,IfNoneMatch:'*',MultipartUpload:{Parts:[{PartNumber:1,ETag:part.ETag}]}}));
  completed=true;
  const head=await target.client.send(new HeadObjectCommand({Bucket:target.bucketName,Key:key}));
  console.log(JSON.stringify({phase:'metadata',partETag:part.ETag,completionETag:completion.ETag,headETag:head.ETag,metadata:head.Metadata,size:head.ContentLength}));
  if(head.ContentLength!==body.length || head.ETag?.replaceAll('\"','') !== createHash('md5').update(Buffer.from(part.ETag!.replaceAll('\"',''),'hex')).digest('hex')+'-1')throw new Error('Upload ownership metadata mismatch');
  console.log(JSON.stringify({phase:'verified',multipart:true,listParts:true,checksumRecovery:true}));
  const collision=await target.client.send(new CreateMultipartUploadCommand({Bucket:target.bucketName,Key:key}));
  const replacement=Buffer.from('replacement fixture');
  const cp=await target.client.send(new UploadPartCommand({Bucket:target.bucketName,Key:key,UploadId:collision.UploadId,PartNumber:1,Body:replacement}));
  try {
    await target.client.send(new CompleteMultipartUploadCommand({Bucket:target.bucketName,Key:key,UploadId:collision.UploadId,IfNoneMatch:'*',MultipartUpload:{Parts:[{PartNumber:1,ETag:cp.ETag}]}}));
    console.log(JSON.stringify({phase:'conditional-collision',protected:false}));
  } catch(e:any) { console.log(JSON.stringify({phase:'conditional-collision',protected:e.$metadata?.httpStatusCode===412,status:e.$metadata?.httpStatusCode})); }
  finally {await target.client.send(new AbortMultipartUploadCommand({Bucket:target.bucketName,Key:key,UploadId:collision.UploadId})).catch((e:any)=>{if(e.name!=='NoSuchUpload')throw e});}
 } finally {
  if(uploadId&&!completed) await target.client.send(new AbortMultipartUploadCommand({Bucket:target.bucketName,Key:key,UploadId:uploadId})).catch((e:any)=>{if(e.name!=='NoSuchUpload')throw e});
  if(completed) {
   await target.client.send(new DeleteObjectCommand({Bucket:target.bucketName,Key:key}));
   try{await target.client.send(new HeadObjectCommand({Bucket:target.bucketName,Key:key}));throw new Error('Cleanup not confirmed');}
   catch(e:any){if(e.$metadata?.httpStatusCode!==404)throw e;}
  }
  console.log(JSON.stringify({phase:'cleanup',completedObjectDeleted:completed,unpublishedUploadAborted:!!uploadId&&!completed}));
 }
}
main().catch(e=>{console.error(JSON.stringify({passed:false,name:e.name,status:e.$metadata?.httpStatusCode,message:e.message}));process.exitCode=1}).finally(()=>prisma.$disconnect());
