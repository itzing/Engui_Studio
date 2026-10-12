import { createHash } from 'node:crypto';
import { WorkspaceError } from './context';
export function multipartETag(parts: Array<{PartNumber:number;ETag:string}>) {
  const sorted = [...parts].sort((a,b)=>a.PartNumber-b.PartNumber);
  const bytes = sorted.map((part,index)=>{
    const tag=part.ETag.replace(/^"|"$/g,'').toLowerCase();
    if(part.PartNumber!==index+1 || !/^[a-f0-9]{32}$/.test(tag)) throw new WorkspaceError('Cannot verify the uploaded part checksum.',409);
    return Buffer.from(tag,'hex');
  });
  if(!bytes.length) throw new WorkspaceError('The upload contains no parts.',409);
  return createHash('md5').update(Buffer.concat(bytes)).digest('hex')+'-'+bytes.length;
}
export function matchesUploadProof(head: {ETag?:string;ContentLength?:number}, metadata: {expectedETag?:string;fileSize?:number}) {
  return !!metadata.expectedETag && head.ETag?.replace(/^"|"$/g,'').toLowerCase()===metadata.expectedETag && head.ContentLength===metadata.fileSize;
}
