import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function StudioPoseLibraryPosePage({ params }: { params: Promise<{ categoryId: string; poseId: string }> }) {
  const { categoryId, poseId } = await params;
  return (
    <>
      <FStudioPageClient route={{ level: 'poseLibraryPose', categoryId, poseId }} />
    </>
  );
}
