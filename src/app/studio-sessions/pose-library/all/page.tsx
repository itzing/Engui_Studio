import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';

export default function StudioPoseLibraryAllPage() {
  return (
    <>
      <FStudioPageClient route={{ level: 'poseLibrary', view: 'all' }} />
    </>
  );
}
