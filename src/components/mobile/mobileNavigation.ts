import type { LucideIcon } from 'lucide-react';
import { FolderOpen, Image as ImageIcon, Rows3, Sparkles } from 'lucide-react';

export type MobileRouteTab = 'create' | 'preview' | 'jobs' | 'gallery';

export const mobileNavItems: Array<{
  id: MobileRouteTab;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { id: 'create', label: 'Create', href: '/m/create', icon: Sparkles },
  { id: 'preview', label: 'Preview', href: '/m/preview', icon: ImageIcon },
  { id: 'jobs', label: 'Jobs', href: '/m/jobs', icon: Rows3 },
  { id: 'gallery', label: 'Gallery', href: '/m/gallery', icon: FolderOpen },
];

export function getMobileTabForPathname(pathname?: string | null): MobileRouteTab {
  if (!pathname) return 'create';
  if (pathname === '/m' || pathname.startsWith('/m/create')) return 'create';
  if (pathname.startsWith('/m/preview')) return 'preview';
  if (pathname.startsWith('/m/jobs')) return 'jobs';
  if (pathname.startsWith('/m/gallery')) return 'gallery';
  return 'create';
}
