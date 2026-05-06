import StudioSessionsPageClient from '@/components/studio-sessions/StudioSessionsPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioSessionsPage() {
  return (
    <StudioProvider>
      <StudioSessionsPageClient />
    </StudioProvider>
  );
}
