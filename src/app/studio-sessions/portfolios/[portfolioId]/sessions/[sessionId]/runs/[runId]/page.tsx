import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function RunPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string; runId: string }> }) {
  const { portfolioId, sessionId, runId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'run', portfolioId, sessionId, runId }} /></StudioProvider>;
}
