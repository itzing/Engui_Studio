import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function RunsPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string }> }) {
  const { portfolioId, sessionId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'runs', portfolioId, sessionId }} /></StudioProvider>;
}
