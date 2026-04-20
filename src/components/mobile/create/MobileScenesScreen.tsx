'use client';

import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useImageCreateState } from '@/hooks/create/useImageCreateState';

export default function MobileScenesScreen() {
  const {
    availableScenes,
    selectedSceneId,
    setSelectedSceneId,
    applySelectedSceneToPrompt,
    applyAllFromScene,
    applyScenePreviewImage,
    isLoadingScenes,
    promptMatchesSelectedScene,
  } = useImageCreateState();

  return (
    <MobileScreen>
      <MobileHeader title="Scenes" subtitle="Apply a saved scene prompt and preview image into the mobile draft." backHref="/m/create" />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-3">
          {isLoadingScenes ? (
            <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">Loading scenes...</div>
          ) : availableScenes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No active scenes available in the current workspace yet.
            </div>
          ) : (
            availableScenes.map((scene) => {
              const active = scene.id === selectedSceneId;
              return (
                <Card key={scene.id} className={active ? 'border-primary/50 bg-primary/10' : ''}>
                  <CardHeader className="pb-3">
                    <CardDescription>{scene.status || 'active'}</CardDescription>
                    <CardTitle className="text-lg">{scene.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                      {scene.generatedScenePrompt || 'No generated scene prompt saved yet.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedSceneId(scene.id)}
                      >
                        {active ? 'Selected' : 'Select'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedSceneId(scene.id);
                        applySelectedSceneToPrompt(scene);
                      }}>
                        Apply prompt
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedSceneId(scene.id);
                        void applyScenePreviewImage(scene);
                      }}>
                        Apply image
                      </Button>
                      <Button size="sm" onClick={() => {
                        setSelectedSceneId(scene.id);
                        void applyAllFromScene(scene);
                      }}>
                        Apply full scene
                      </Button>
                    </div>
                    {active && promptMatchesSelectedScene ? (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                        Current prompt already matches this scene.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </MobileScreen>
  );
}
