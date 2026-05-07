import StudioPortfolioPageClient from '@/components/studio-sessions/StudioPortfolioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioSessionsPage() {
  return (
    <StudioProvider>
      <StudioPortfolioPageClient />
    </StudioProvider>
  );
}
