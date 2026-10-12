import path from 'path';
import { multipartETag, matchesUploadProof } from './uploadProof';
import { randomUUID } from 'crypto';
import { HeadBucketCommand, HeadObjectCommand, ListMultipartUploadsCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getMultipartPartSize } from '@/lib/s3MultipartUpload';
import { validateLoRAFileServer } from '@/lib/loraValidation';
import { requireWorkspaceId, WorkspaceError } from './context';
import { assertStorageLease, assertTarget, directKey, loraPrefix, objectMissing, storageTarget, withStorageLease } from './storage';

export async function uploadBinding(input: { uploadId: string; key: string; volume: string }) {
  const workspaceId = requireWorkspaceId();
  const upload = await prisma.workspaceUpload.findUnique({ where: { uploadId: input.uploadId } });
  if (!upload || upload.workspaceId !== workspaceId || upload.objectKey !== input.key) throw new WorkspaceError('Upload does not belong to this workspace.', 403);
  const target = await assertTarget(upload.storageTarget);
  if (target.bucketName !== input.volume) throw new WorkspaceError('Upload storage target mismatch.', 403);
  if (!directKey(upload.objectKey, await loraPrefix(workspaceId))) throw new WorkspaceError('Invalid upload namespace.', 409);
  return { upload, target, metadata: JSON.parse(upload.metadataJson) };
}
export async function startLoraUpload(input: { fileName: string; fileSize: number; contentType?: string; baseModel?: string }) {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'upload-init', async () => {
    const validation = validateLoRAFileServer(input.fileName, input.fileSize);
    if (!validation.valid) throw new WorkspaceError(validation.error || 'Invalid LoRA file.', 400);
    const prefix = await loraPrefix(workspaceId);
    if (!directKey(prefix + input.fileName, prefix)) throw new WorkspaceError('Use a plain file name without directories.', 400);
    // RunPod ignores conditional CompleteMultipartUpload. A server-generated
    // object identity avoids overwriting an existing key on every provider.
    const key = prefix + randomUUID() + '__' + input.fileName;
    if (await prisma.loRA.findFirst({ where: { workspaceId, fileName: input.fileName } })) throw new WorkspaceError('This file name is already in your library. Rename the new file.', 409);
    const pendingNames = await prisma.workspaceUpload.findMany({ where: { workspaceId, status: { in: ['pending', 'finalizing'] } } });
    if (pendingNames.some(row => JSON.parse(row.metadataJson).fileName === input.fileName)) throw new WorkspaceError('This file name has a pending upload. Finish or discard it first.', 409);
    if (!directKey(key, prefix)) throw new WorkspaceError('Use a plain file name without directories.', 400);
    const target = await storageTarget();
    await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
    if (!await objectMissing(target, key) || await prisma.workspaceUpload.count({ where: { objectKey: key, storageTarget: target.fingerprint, status: { in: ['pending', 'finalizing'] } } })) throw new WorkspaceError('This file name already exists or is uploading. Rename the new file.', 409);
    const pending = await prisma.workspaceUpload.create({ data: { workspaceId, uploadId: 'initializing:' + randomUUID(), objectKey: key, storageTarget: target.fingerprint, metadataJson: JSON.stringify(input) } });
    const response = await target.client.send(new CreateMultipartUploadCommand({ Bucket: target.bucketName, Key: key, ContentType: input.contentType || 'application/octet-stream', Metadata: { 'engui-upload-owner': workspaceId, 'engui-upload-id': pending.id } }));
    if (!response.UploadId) throw new WorkspaceError('S3 did not return an upload ID.', 502);
    await prisma.workspaceUpload.update({ where: { id: pending.id }, data: { uploadId: response.UploadId } });
    return { uploadId: response.UploadId, key, volume: target.bucketName, partSize: getMultipartPartSize(input.fileSize), filePath: '/runpod-volume/' + key };
  });
}
export async function putLoraPart(input: { uploadId: string; key: string; volume: string; partNumber: number; body: Buffer }) {
  const { upload, target } = await uploadBinding(input);
  if (upload.status !== 'pending' || !Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) throw new WorkspaceError('Invalid upload part or state.', 409);
  const response = await target.client.send(new UploadPartCommand({ Bucket: target.bucketName, Key: upload.objectKey, UploadId: upload.uploadId, PartNumber: input.partNumber, Body: input.body, ContentLength: input.body.length }));
  return { partNumber: input.partNumber, eTag: response.ETag };
}
export async function finishLoraUpload(input: { uploadId: string; key: string; volume: string; baseModel?: string }) {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'upload-finalize', async () => {
    const { upload, target, metadata } = await uploadBinding(input);
    if (upload.status === 'completed') {
      return prisma.loRA.findFirstOrThrow({ where: { workspaceId, sourceKey: upload.objectKey, storageTarget: upload.storageTarget } });
    }
    if (!['pending', 'finalizing'].includes(upload.status)) throw new WorkspaceError('Upload is no longer active.', 409);
    if (upload.status === 'pending' || await objectMissing(target, upload.objectKey)) {
      const parts: Array<{ PartNumber: number; ETag: string }> = [];
      let marker: string | undefined;
      let size = 0;
      do {
        const page = await target.client.send(new ListPartsCommand({ Bucket: target.bucketName, Key: upload.objectKey, UploadId: upload.uploadId, PartNumberMarker: marker }));
        for (const part of page.Parts || []) {
          if (!part.PartNumber || !part.ETag || !Number.isFinite(part.Size)) throw new WorkspaceError('S3 returned an incomplete part.', 502);
          size += part.Size!;
          parts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
        }
        const next = page.IsTruncated ? page.NextPartNumberMarker : undefined;
        if (page.IsTruncated && (!next || next === marker)) throw new WorkspaceError('Incomplete upload part listing.', 502);
        marker = next;
      } while (marker);
      if (size !== metadata.fileSize || !parts.length) throw new WorkspaceError('The uploaded file is incomplete.', 409);
      await assertStorageLease();
      await assertTarget(upload.storageTarget);
      metadata.expectedETag = multipartETag(parts);
      metadata.baseModel = input.baseModel || metadata.baseModel || 'z-image';
      await prisma.workspaceUpload.update({ where: { id: upload.id }, data: { status: 'finalizing', metadataJson: JSON.stringify(metadata) } });
      await target.client.send(new CompleteMultipartUploadCommand({ Bucket: target.bucketName, Key: upload.objectKey, UploadId: upload.uploadId, MultipartUpload: { Parts: parts }, IfNoneMatch: '*' }));
    }
    // A retry after successful completion can adopt only this upload's exact object.
    const head = await target.client.send(new HeadObjectCommand({ Bucket: target.bucketName, Key: upload.objectKey }));
    if (!matchesUploadProof(head, metadata)) throw new WorkspaceError('Finalized object does not match this upload checksum.', 409);
    if (head.ContentLength !== metadata.fileSize) throw new WorkspaceError('Finalized object size does not match the upload.', 409);
    await assertTarget(upload.storageTarget);
    const requestedModel = input.baseModel || metadata.baseModel || 'z-image';
    const baseModel = ['wan2.2', 'z-image', 'krea2-turbo'].includes(requestedModel) ? requestedModel : 'z-image';
    await assertStorageLease();
    return prisma.$transaction(async tx => {
      const existing = await tx.loRA.findFirst({ where: { workspaceId, sourceKey: upload.objectKey, storageTarget: upload.storageTarget } });
      const lora = existing || await tx.loRA.create({ data: {
        workspaceId, name: path.basename(metadata.fileName, path.extname(metadata.fileName)), fileName: metadata.fileName,
        sourceKey: upload.objectKey, storageTarget: upload.storageTarget,
        s3Path: '/runpod-volume/' + upload.objectKey,
        s3Url: target.endpointUrl.replace(/\/$/, '') + '/' + target.bucketName + '/' + upload.objectKey,
        fileSize: BigInt(metadata.fileSize), extension: path.extname(metadata.fileName).toLowerCase(), baseModel, targetOverride: baseModel === 'wan2.2' ? 'video' : 'image',
      } });
      await tx.workspaceUpload.update({ where: { id: upload.id }, data: { status: 'completed' } });
      return lora;
    });
  });
}
export async function abortLoraUpload(input: { uploadId: string; key: string; volume: string }) {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'upload-abort', async () => {
    const { upload, target } = await uploadBinding(input);
    if (upload.status === 'completed') throw new WorkspaceError('Delete the published LoRA from the library instead.', 409);
    if (upload.status !== 'aborted') {
      await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
      await assertStorageLease();
      if (upload.status === 'finalizing' && !await objectMissing(target, upload.objectKey)) {
        const head = await target.client.send(new HeadObjectCommand({ Bucket: target.bucketName, Key: upload.objectKey }));
        if (!matchesUploadProof(head, JSON.parse(upload.metadataJson))) throw new WorkspaceError('Cannot remove an object that is not owned by this upload.', 409);
        await target.client.send(new DeleteObjectCommand({ Bucket: target.bucketName, Key: upload.objectKey }));
        if (!await objectMissing(target, upload.objectKey)) throw new WorkspaceError('Upload deletion was not confirmed.', 409);
      }
      if (upload.uploadId.startsWith('initializing:')) {
        const page = await target.client.send(new ListMultipartUploadsCommand({ Bucket: target.bucketName, Prefix: upload.objectKey }));
        if (page.IsTruncated) throw new WorkspaceError('Multipart discovery is incomplete. Retry.', 409);
        for (const item of page.Uploads || []) if (item.Key === upload.objectKey && item.UploadId) {
          await target.client.send(new AbortMultipartUploadCommand({ Bucket: target.bucketName, Key: item.Key, UploadId: item.UploadId }));
        }
      } else {
        try { await target.client.send(new AbortMultipartUploadCommand({ Bucket: target.bucketName, Key: upload.objectKey, UploadId: upload.uploadId })); }
        catch (e: any) { if (e?.name !== 'NoSuchUpload') throw e; }
      }
      await prisma.workspaceUpload.update({ where: { id: upload.id }, data: { status: 'aborted' } });
    }
    return { success: true };
  });
}
