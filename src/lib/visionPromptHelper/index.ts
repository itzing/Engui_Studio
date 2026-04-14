import { LocalVisionPromptHelperProvider } from './localProvider';
import { VisionPromptHelperProvider, VisionPromptHelperSettings } from './types';

export function getVisionPromptHelperProvider(settings: VisionPromptHelperSettings): VisionPromptHelperProvider {
  const provider = settings?.provider || 'disabled';

  if (provider === 'disabled') {
    throw new Error('Vision Prompt Helper provider is disabled');
  }

  if (provider === 'local') {
    return new LocalVisionPromptHelperProvider(settings.local);
  }

  throw new Error(`Unsupported Vision Prompt Helper provider: ${provider}`);
}

export * from './types';
