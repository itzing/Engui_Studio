import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';

async function POSTImpl(request: NextRequest) {
  const formData = await request.formData();
  return submitGenerationFormData(formData);
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
