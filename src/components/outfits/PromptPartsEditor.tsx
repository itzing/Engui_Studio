"use client";
import { REGIONS, partDocument, readPartDocument, type PromptPart, type PartDocument } from '@/lib/looks/parts';
const control='rounded border border-white/20 bg-zinc-900 p-2 text-xs text-white';
export default function PromptPartsEditor({value,source,onChange,initialParts=[],title='Visible details',disabled=false}:{value?:PartDocument|null;source:unknown;onChange:(doc:PartDocument)=>void;initialParts?:PromptPart[];title?:string;disabled?:boolean}) {
 const parts=value?.parts||initialParts;
 const fresh=!!readPartDocument(value,source);
 function update(next:PromptPart[]){onChange(partDocument(source,next.filter(p=>p.text.trim())));}
 return <details className="min-w-0 rounded border border-white/15 p-3"><summary className="cursor-pointer text-sm">{title}{fresh?' · Ready':' · Review needed'}</summary><div className="mt-3 space-y-3">
 <p className="text-xs text-white/60">Describe only what is visible in each region. Split long coats into collar, torso and lower panels. These details are used for new previews and runs; the original description is preserved.</p>
 {!fresh&&<p className="text-xs text-amber-200">Review these parts after source edits. Cropped views need a current classification.</p>}
 {parts.map((part,i)=><div key={i} className="min-w-0 space-y-2 rounded border border-white/10 p-2">
 <div className="flex flex-wrap gap-2"><select disabled={disabled} aria-label={'Region '+(i+1)} className={control} value={part.region} onChange={e=>update(parts.map((p,j)=>j===i?{...p,region:e.target.value as any}:p))}>{REGIONS.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select><button disabled={disabled} type="button" className={control} onClick={()=>update(parts.filter((_,j)=>j!==i))}>Remove</button></div>
 <textarea disabled={disabled} aria-label={'Visible detail '+(i+1)} rows={2} maxLength={3000} className={control+' w-full'} value={part.text} onChange={e=>{const next=parts.map((p,j)=>j===i?{...p,text:e.target.value}:p);onChange({...partDocument(source,next.filter(p=>p.text.trim())),parts:next});}}/>
 {part.region==='face'&&<label className="flex gap-2 text-xs"><input disabled={disabled} type="checkbox" checked={!!part.exposed} onChange={e=>update(parts.map((p,j)=>j===i?{...p,exposed:e.target.checked}:p))}/>Visible even with the assigned face covering (for example, exposed jaw)</label>}
 </div>)}
 <div className="flex flex-wrap gap-2"><button disabled={disabled} type="button" className={control} onClick={()=>update([...parts,{region:'unclassified',text:'Describe this visible detail'}])}>Add part</button><button disabled={disabled||!parts.length||parts.some(p=>p.region==='unclassified'||!p.text.trim())} type="button" className={control} onClick={()=>update(parts)}>Confirm reviewed details</button></div>
 </div></details>;
}
