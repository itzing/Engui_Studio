'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CharacterPreviewSlot, CharacterSummary } from '@/lib/characters/types';

const PREVIEW_SLOTS: Array<{ slot: CharacterPreviewSlot; label: string }> = [
  { slot: 'portrait', label: 'Portrait' },
  { slot: 'upper_body', label: 'Upper body' },
  { slot: 'full_body', label: 'Full body' },
];

type CharacterSelectModalProps = {
  open: boolean;
  characters: CharacterSummary[];
  selectedCharacterId?: string | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (character: CharacterSummary) => void;
};

export function getCharacterPreviewUrl(character: CharacterSummary, slot: CharacterPreviewSlot): string | null {
  const state = character.previewState?.[slot];
  return state?.thumbnailUrl || state?.previewUrl || state?.imageUrl || null;
}

export function CharacterPreviewTriptych({ character, compact = false }: { character: CharacterSummary; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {PREVIEW_SLOTS.map(({ slot, label }) => {
        const imageUrl = getCharacterPreviewUrl(character, slot);
        return (
          <div key={slot} className="min-w-0">
            <div className={`mb-1 truncate ${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.14em] text-white/40`}>{label}</div>
            <div className={`${compact ? 'h-24' : 'h-32'} overflow-hidden rounded-md border border-white/10 bg-black/25`}>
              {imageUrl ? (
                <img src={imageUrl} alt={`${character.name} ${label.toLowerCase()} preview`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-white/35">No preview</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CharacterSelectModal({
  open,
  characters,
  selectedCharacterId,
  loading = false,
  onOpenChange,
  onSelect,
}: CharacterSelectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl border-white/10 bg-[#101014] text-white">
        <DialogHeader>
          <DialogTitle>Select character</DialogTitle>
          <DialogDescription className="text-white/50">Pick a character from Character Manager. Click anywhere on an item to select it.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
          {loading ? <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">Loading characters…</div> : null}
          {!loading && characters.length === 0 ? <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">No characters available.</div> : null}
          {!loading && characters.map((character) => {
            const selected = selectedCharacterId === character.id;
            const bodyType = character.traits?.body_build || 'Body type not set';
            return (
              <button
                key={character.id}
                type="button"
                onClick={() => onSelect(character)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? 'border-blue-400/60 bg-blue-500/15' : 'border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.06]'}`}
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{character.name}</div>
                    <div className="mt-0.5 truncate text-xs text-white/50">{bodyType}</div>
                  </div>
                  {selected ? <div className="shrink-0 rounded-full border border-blue-400/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-blue-100">Selected</div> : null}
                </div>
                <CharacterPreviewTriptych character={character} />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
