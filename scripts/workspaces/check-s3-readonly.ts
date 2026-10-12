import { storageTarget, completeListing } from '../../src/lib/workspaces/storage';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../../src/lib/prisma';
async function main() {
 const target = await storageTarget();
 const files = await completeListing(target, 'loras/');
 if (files[0]) {
   const head = await target.client.send(new HeadObjectCommand({ Bucket: target.bucketName, Key: files[0].Key }), { abortSignal: AbortSignal.timeout(30000) });
   if (head.ContentLength !== files[0].Size) throw new Error('Object changed during the read-only check.');
 }
 console.log(JSON.stringify({passed:true,readOnly:true,completeListing:true,headObject:!!files[0],objects:files.length}));
}
main().catch(e=>{console.error(JSON.stringify({passed:false,name:e.name,status:e.$metadata?.httpStatusCode}));process.exitCode=1}).finally(()=>prisma.$disconnect());
