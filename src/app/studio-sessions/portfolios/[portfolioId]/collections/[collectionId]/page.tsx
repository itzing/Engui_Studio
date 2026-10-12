import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function CollectionPage({ params }: { params: Promise<{ portfolioId: string; collectionId: string }> }) {
  const { portfolioId, collectionId } = await params;
  return <><FStudioPageClient route={{ level: 'collection', portfolioId, collectionId }} /></>;
}
