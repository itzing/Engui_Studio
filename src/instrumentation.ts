export async function register() {
  if (process.env.ENGUI_ISOLATED_VALIDATION === '1') return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { startRunPodSupervisor } = await import('@/lib/runpodSupervisor');
  startRunPodSupervisor();
  const { startWorkspaceDeletionWorker } = await import('@/lib/workspaces/deletion');
  startWorkspaceDeletionWorker();
}
