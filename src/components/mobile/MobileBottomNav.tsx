'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMobileTabForPathname, mobileNavItems } from './mobileNavigation';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const activeTab = getMobileTabForPathname(pathname);

  return (
    <nav className="border-t border-border bg-background/95 px-2 pt-0 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
        {mobileNavItems.map(({ id, label, href, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
