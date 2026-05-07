import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function PortfolioCollectionsPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'portfolio', portfolioId, section: 'collections' }} /></StudioProvider>;
}
