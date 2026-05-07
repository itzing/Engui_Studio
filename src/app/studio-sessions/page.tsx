import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioSessionsPage() {
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'portfolios' }} />
    </StudioProvider>
  );
}
