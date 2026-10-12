import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function SessionPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string }> }) {
  const { portfolioId, sessionId } = await params;
  return <><FStudioPageClient route={{ level: 'session', portfolioId, sessionId }} /></>;
}
