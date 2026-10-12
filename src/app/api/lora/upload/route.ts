import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { startLoraUpload, putLoraPart, finishLoraUpload, abortLoraUpload } from '@/lib/workspaces/loraUpload';
export const POST = withWorkspaceRoute(async request => {
  const form = await request.formData();
  const files = form.getAll('file') as File[];
  if (!files.length) return NextResponse.json({ success: false, error: 'No files provided.' }, { status: 400 });
  const results = [];
  for (const file of files) {
    const init = await startLoraUpload({ fileName: file.name, fileSize: file.size, contentType: file.type, baseModel: String(form.get('baseModel') || 'z-image') });
    try {
      for (let start = 0, part = 1; start < file.size; start += init.partSize, part++) {
        await putLoraPart({ ...init, partNumber: part, body: Buffer.from(await file.slice(start, start + init.partSize).arrayBuffer()) });
      }
      const row = await finishLoraUpload({ ...init, baseModel: String(form.get('baseModel') || 'z-image') });
      results.push({ ...row, fileSize: row.fileSize.toString() });
    } catch (error) {
      await abortLoraUpload(init).catch(() => undefined);
      throw error;
    }
  }
  return NextResponse.json({ success: true, loras: results, results });
});
