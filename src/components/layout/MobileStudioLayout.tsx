'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, Image as ImageIcon, Sparkles } from 'lucide-react';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

type MobileTab = 'create' | 'preview' | 'library';

const tabs: Array<{ id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'create', label: 'Create', icon: Sparkles },
  { id: 'preview', label: 'Preview', icon: ImageIcon },
  { id: 'library', label: 'Library', icon: FolderOpen },
];

export default function MobileStudioLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('create');

  useEffect(() => {
    const openPreview = (event: Event) => {
      const custom = event as CustomEvent<{ modelId?: string; type?: string } | null>;
      if (custom.detail?.modelId === 'gallery') return;
      setActiveTab('preview');
    };
    const openPreviewInfo = () => setActiveTab('preview');
    const openLibrary = () => setActiveTab('library');

    window.addEventListener('jobHoverPreview', openPreview as EventListener);
    window.addEventListener('openPreviewInfo', openPreviewInfo as EventListener);
    window.addEventListener('galleryAssetChanged', openLibrary as EventListener);

    return () => {
      window.removeEventListener('jobHoverPreview', openPreview as EventListener);
      window.removeEventListener('openPreviewInfo', openPreviewInfo as EventListener);
      window.removeEventListener('galleryAssetChanged', openLibrary as EventListener);
    };
  }, []);

  return (
    <div className="flex h-screen min-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        {activeTab === 'create' && <LeftPanel mobile />}
        {activeTab === 'preview' && <CenterPanel mobile />}
        {activeTab === 'library' && <RightPanel mobile />}
      </div>

      <nav className="border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
