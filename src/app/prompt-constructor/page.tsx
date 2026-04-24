import PromptConstructorPageClient from '@/components/prompt-constructor/PromptConstructorPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function PromptConstructorPage() {
  return (
    <StudioProvider>
      <PromptConstructorPageClient />
    </StudioProvider>
  );
}
