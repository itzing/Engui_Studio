import { LocalPromptHelperProvider } from './localProvider';
import { PromptHelperProvider, PromptHelperSettings } from './types';

export function getPromptHelperProvider(settings: PromptHelperSettings): PromptHelperProvider {
  const provider = settings?.provider || 'disabled';

  if (provider === 'disabled') {
    throw new Error('Prompt Helper provider is disabled');
  }

  if (provider === 'local') {
    return new LocalPromptHelperProvider(settings.local);
  }

  throw new Error(`Unsupported Prompt Helper provider: ${provider}`);
}

export * from './types';
