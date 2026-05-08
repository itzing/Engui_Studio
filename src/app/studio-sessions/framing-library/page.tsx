import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioFramingLibraryPage() {
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'framingLibrary' }} />
    </StudioProvider>
  );
}
