import { getModelById, getModelsByType, isInputVisible, validateParameter } from '@/lib/models/modelConfig';
import { settingsSchema, type BatchSettings } from './types';

export function batchImageModels() {
  return getModelsByType('image').filter(model => model.api.type === 'runpod' && model.inputs.includes('text') &&
    !(['image', 'image2'] as const).some(input => isInputVisible(model, input, {}) && !model.optionalInputs?.includes(input)));
}
export function validateBatchSettings(input: unknown): BatchSettings {
  const s = settingsSchema.parse(input);
  const model = getModelById(s.modelId);
  if (!model || !batchImageModels().some(m => m.id === model.id)) throw new Error('Choose a text-to-image model.');
  const parameters: BatchSettings['parameters'] = {};
  for (const [key, value] of Object.entries(s.parameters)) {
    const p = model.parameters.find(p => p.name === key && p.group !== 'hidden' && p.type !== 'lora-selector' && !/^loraWeight/.test(key) && key !== 'seed');
    if (!p) throw new Error(`Unsupported generation parameter: ${key}`);
    const check = validateParameter(p, value);
    if (!check.valid || (p.type === 'string' && typeof value !== 'string') || (p.type === 'boolean' && typeof value !== 'boolean')) throw new Error(`Invalid ${p.label}: ${check.error || 'wrong value type'}`);
    if (typeof value === 'string' && value.length > 8000) throw new Error(`${p.label} is too long.`);
    parameters[key] = value;
  }
  if (s.loras.length && !model.parameters.some(p => p.type === 'lora-selector')) throw new Error('This model does not support LoRAs.');
  if (new Set(s.loras.map(l => l.id)).size !== s.loras.length) throw new Error('Select each LoRA only once.');
  return { ...s, parameters };
}
