import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function SessionPage({ params }: { params: Promise<{ portfolioId: string; sessionId: string }> }) {
  const { portfolioId, sessionId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'session', portfolioId, sessionId }} /></StudioProvider>;
}
