import { describe,it,expect } from 'vitest';
import { multipartETag,matchesUploadProof } from '@/lib/workspaces/uploadProof';
describe('multipart recovery proof',()=>{
 it('matches the observed RunPod fixture without relying on discarded custom metadata',()=>{
  const expectedETag=multipartETag([{PartNumber:1,ETag:'"88c768b2437a0dcde70f35d79c154669"'}]);
  expect(expectedETag).toBe('f69ff9d5de4167acf7f1057381ae5009-1');
  expect(matchesUploadProof({ETag:'"'+expectedETag+'"',ContentLength:48},{expectedETag,fileSize:48})).toBe(true);
 });
 it('rejects foreign, incomplete and unknown uploads',()=>{
  expect(matchesUploadProof({ETag:'"foreign"',ContentLength:48},{expectedETag:'expected',fileSize:48})).toBe(false);
  expect(matchesUploadProof({ETag:'"expected"',ContentLength:47},{expectedETag:'expected',fileSize:48})).toBe(false);
  expect(matchesUploadProof({ContentLength:48},{fileSize:48})).toBe(false);
  expect(()=>multipartETag([{PartNumber:2,ETag:'"88c768b2437a0dcde70f35d79c154669"'}])).toThrow();
 });
});
