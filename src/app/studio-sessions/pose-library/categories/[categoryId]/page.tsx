import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default async function StudioPoseLibraryCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  return (
    <>
      <FStudioPageClient route={{ level: 'poseLibraryCategory', categoryId }} />
    </>
  );
}
