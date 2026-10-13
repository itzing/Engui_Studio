"use client";
import { useEffect, useState } from 'react';
import { IMAGE_MODELS } from '@/lib/generation/imageModelPolicy';
export function useImageModelPreference() {
  const [modelId, setModel] = useState('z-image');
  useEffect(() => { try { const value = localStorage.getItem('engui.image-model'); if (IMAGE_MODELS.some(m => m.id === value)) setModel(value!); } catch {} }, []);
  const setModelId = (value: string) => { setModel(value); try { localStorage.setItem('engui.image-model', value); } catch {} };
  return [modelId, setModelId] as const;
}
export default function ImageModelSelect({ value, onChange, disabled = false }: { value: string; onChange: (value:string)=>void; disabled?:boolean }) {
  return <label className="block space-y-1 text-xs"><span>Generation model</span><select aria-label="Generation model" disabled={disabled} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded border border-white/20 bg-zinc-900 p-2 text-white">{IMAGE_MODELS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>{value === 'krea2-turbo' && <span className="block text-white/50">Pose prompt only · no OpenPose</span>}</label>;
}
