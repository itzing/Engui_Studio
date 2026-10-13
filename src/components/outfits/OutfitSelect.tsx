"use client";
import PromptPartsEditor from "./PromptPartsEditor";
import { outfitSource } from "@/lib/looks/parts";
import { useEffect, useState } from 'react';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';
import type { OutfitSelection, OutfitSummary } from '@/lib/outfits/types';
export default function OutfitSelect({ characterId, value, onChange, neutral = false, disabled = false, refresh = 0 }: { characterId: string | null; value: OutfitSelection; onChange: (value:OutfitSelection)=>void; neutral?:boolean; disabled?:boolean; refresh?:number }) {
  const fetch = useWorkspaceFetch();
  const [outfits,setOutfits] = useState<OutfitSummary[]>([]);
  const [error,setError] = useState('');
  useEffect(()=>{ let active=true; setOutfits([]);setError(''); if(characterId) void fetch(`/api/characters/${characterId}/wardrobe`).then(r=>r.json()).then(d=>{if(active){if(!d.success)throw new Error(d.error);setOutfits(d.outfits);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;}; },[characterId,fetch,refresh]);
  return <div className="space-y-2 text-xs"><label className="block">Outfit mode<select aria-label="Outfit mode" disabled={disabled} value={value.mode || 'default'} onChange={e=>onChange({mode:e.target.value as any, outfitId:null,customText:''})} className="mt-1 w-full rounded border border-white/20 bg-zinc-900 p-2 text-white"><option value="default">Character default</option><option value="outfit">Choose outfit</option><option value="custom">Custom outfit</option>{neutral&&<option value="neutral">Neutral anatomy</option>}</select></label>
  {value.mode==='outfit'&&<select aria-label="Choose outfit" disabled={disabled} value={value.outfitId||''} onChange={e=>onChange({...value,outfitId:e.target.value})} className="w-full rounded border border-white/20 bg-zinc-900 p-2 text-white"><option value="">Choose an outfit…</option>{outfits.map(o=><option key={o.id} value={o.id}>{o.name} · {o.ownerCharacterId?'Personal':'Shared'}</option>)}</select>}
  {value.mode==='custom'&&<textarea aria-label="Custom outfit" disabled={disabled} value={value.customText||''} onChange={e=>onChange({...value,customText:e.target.value})} placeholder="Describe the complete outfit; this replaces the default costume." rows={4} className="w-full rounded border border-white/20 bg-zinc-900 p-2 text-white"/>}
  {value.mode==='custom'&&<PromptPartsEditor value={value.customParts} source={outfitSource(value.customText||'')} onChange={customParts=>onChange({...value,customParts})} disabled={disabled} title="Custom outfit visible details"/>}
  {error&&<p role="alert" className="text-red-300">{error}</p>}</div>;
}
