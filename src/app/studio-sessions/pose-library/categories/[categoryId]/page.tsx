import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function StudioPoseLibraryCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'poseLibraryCategory', categoryId }} />
    </StudioProvider>
  );
}
