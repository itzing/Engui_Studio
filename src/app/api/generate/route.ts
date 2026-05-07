import { NextRequest } from 'next/server';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return submitGenerationFormData(formData);
}
