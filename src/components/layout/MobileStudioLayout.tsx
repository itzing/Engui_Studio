'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, Image as ImageIcon, Sparkles, Rows3 } from 'lucide-react';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

type MobileTab = 'create' | 'preview' | 'jobs' | 'gallery';

const tabs: Array<{ id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'create', label: 'Create', icon: Sparkles },
  { id: 'preview', label: 'Preview', icon: ImageIcon },
  { id: 'jobs', label: 'Jobs', icon: Rows3 },
  { id: 'gallery', label: 'Gallery', icon: FolderOpen },
];

export default function MobileStudioLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('create');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTab = window.localStorage.getItem('engui.mobile.active-tab');
    if (savedTab === 'create' || savedTab === 'preview' || savedTab === 'jobs' || savedTab === 'gallery') {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.mobile.active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const openCreate = () => setActiveTab('create');
    const openPreview = () => setActiveTab('preview');
    const openPreviewInfo = () => setActiveTab('preview');
    const openJobs = () => setActiveTab('jobs');
    const openGallery = () => setActiveTab('gallery');

    window.addEventListener('mobileOpenCreateTab', openCreate as EventListener);
    window.addEventListener('reuseJobInput', openCreate as EventListener);
    window.addEventListener('mobileOpenPreviewTab', openPreview as EventListener);
    window.addEventListener('openPreviewInfo', openPreviewInfo as EventListener);
    window.addEventListener('mobileOpenJobsTab', openJobs as EventListener);
    window.addEventListener('mobileOpenGalleryTab', openGallery as EventListener);

    return () => {
      window.removeEventListener('mobileOpenCreateTab', openCreate as EventListener);
      window.removeEventListener('reuseJobInput', openCreate as EventListener);
      window.removeEventListener('mobileOpenPreviewTab', openPreview as EventListener);
      window.removeEventListener('openPreviewInfo', openPreviewInfo as EventListener);
      window.removeEventListener('mobileOpenJobsTab', openJobs as EventListener);
      window.removeEventListener('mobileOpenGalleryTab', openGallery as EventListener);
    };
  }, []);

  return (
    <div className="flex h-screen min-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        <div className={activeTab === 'create' ? 'flex h-full min-h-0' : 'hidden h-full min-h-0'}>
          <LeftPanel mobile />
        </div>
        <div className={activeTab === 'preview' ? 'flex h-full min-h-0' : 'hidden h-full min-h-0'}>
          <CenterPanel mobile />
        </div>
        {activeTab === 'jobs' && (
          <div className="flex h-full min-h-0">
            <RightPanel mobile mobileMode="jobs" />
          </div>
        )}
        {activeTab === 'gallery' && (
          <div className="flex h-full min-h-0">
            <RightPanel mobile mobileMode="gallery" />
          </div>
        )}
      </div>

      <nav className="border-t border-border bg-background/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="grid grid-cols-4 gap-2">
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
