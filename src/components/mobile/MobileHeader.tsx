import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileHeader({
  title,
  subtitle,
  backHref,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {backHref && (
            <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          )}
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
