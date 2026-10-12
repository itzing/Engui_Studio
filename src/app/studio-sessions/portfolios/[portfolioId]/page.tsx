import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function PortfolioPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  return <><FStudioPageClient route={{ level: 'portfolio', portfolioId }} /></>;
}
