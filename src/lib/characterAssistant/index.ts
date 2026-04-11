import { LocalCharacterAssistantProvider } from './localProvider';
import type { CharacterAssistantProvider, CharacterAssistantSettings } from './types';

export function getCharacterAssistantProvider(settings: CharacterAssistantSettings): CharacterAssistantProvider {
  const provider = settings?.provider || 'disabled';

  if (provider === 'disabled') {
    throw new Error('Character Assistant provider is disabled');
  }

  if (provider === 'local') {
    return new LocalCharacterAssistantProvider(settings.local);
  }

  throw new Error(`Unsupported Character Assistant provider: ${provider}`);
}

export * from './types';
