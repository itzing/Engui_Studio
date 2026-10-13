export const IMAGE_MODELS = [{ id: 'z-image', name: 'Z-Image', steps: 9 }, { id: 'krea2-turbo', name: 'Krea2 Turbo', steps: 8 }] as const;
export class ImageModelValidationError extends Error { status = 400; }
export function imageModelPolicy(value: unknown = 'z-image') {
  const model = IMAGE_MODELS.find(m => m.id === value);
  if (!model) throw new ImageModelValidationError('Choose Z-Image or Krea2 Turbo.');
  return { modelId: model.id, steps: model.steps, cfg: 1, useControlnet: model.id === 'z-image' };
}
export function generationErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error || 'Generation failed');
  return /ENDPOINT_PAUSED|max_workers=0/.test(text) ? 'The selected generation endpoint is paused. Choose another model or enable the endpoint in your provider settings.' : text;
}
