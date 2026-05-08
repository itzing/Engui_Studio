import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default async function StudioPoseLibraryPosePage({ params }: { params: Promise<{ categoryId: string; poseId: string }> }) {
  const { categoryId, poseId } = await params;
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'poseLibraryPose', categoryId, poseId }} />
    </StudioProvider>
  );
}
