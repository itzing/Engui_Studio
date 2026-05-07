import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function CollectionPage({ params }: { params: Promise<{ portfolioId: string; collectionId: string }> }) {
  const { portfolioId, collectionId } = await params;
  return <StudioProvider><FStudioPageClient route={{ level: 'collection', portfolioId, collectionId }} /></StudioProvider>;
}
