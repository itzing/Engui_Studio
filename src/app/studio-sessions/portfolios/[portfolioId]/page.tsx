import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function PortfolioPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'portfolio', portfolioId }} /></StudioProvider>;
}
