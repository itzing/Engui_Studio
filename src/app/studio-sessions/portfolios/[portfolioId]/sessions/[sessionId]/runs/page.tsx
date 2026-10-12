import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function RunsPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string }> }) {
  const { portfolioId, sessionId } = await params;
  return <><FStudioPageClient route={{ level: 'runs', portfolioId, sessionId }} /></>;
}
