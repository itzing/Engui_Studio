import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function RunPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string; runId: string }> }) {
  const { portfolioId, sessionId, runId } = await params;
  return <><FStudioPageClient route={{ level: 'run', portfolioId, sessionId, runId }} /></>;
}
