import { describe, expect, it } from 'vitest';
import { parseCardRows, documentFromRows, exportCardRows, replaceCard, cardIsReady, missingVariantKeys } from '@/lib/batch-cards/types';
import { validateBatchSettings, batchImageModels } from '@/lib/batch-cards/settings';
const rows = (n = 1, count = 3) => Array.from({ length: count }, (_, i) => ({ key: `card${n}-${i}`, n, card: `Card ${n}`, class: 'Bureaucrat', effect: 'Tax', variant: String.fromCharCode(65 + i), route: ['name', 'effect', 'unexpected'][i % 3], prompt: 'Exact {red|blue} prompt. ', stylePack: 'base', pick: i === 0, extra: { keep: true } }));
describe('batch card document', () => {
  it('round-trips unknown fields, order and exact prompts', () => { const source = [...rows(2,5),...rows()]; expect(exportCardRows(documentFromRows(parseCardRows(JSON.stringify(source))))).toEqual(source); });
  it('accepts complete fenced JSON, not incomplete/trailing comma input', () => { expect(parseCardRows('```json\n'+JSON.stringify(rows())+'\n```')).toHaveLength(3); expect(()=>parseCardRows(JSON.stringify(rows()).slice(0,-1))).toThrow('complete array'); });
  it('requires 3–5 consistent uniquely keyed variants and one pick at most', () => {
    for (const source of [rows(1,2),rows(1,6),[...rows(),rows()[0]],rows().map(r=>({...r,pick:true})),rows().map((r,i)=>({...r,card:i ? 'Different':r.card})),rows().map((r,i)=>({...r,variant:i ? 'A':r.variant}))]) expect(()=>parseCardRows(source)).toThrow();
  });
  it('rejects prototype keys and whitespace-only prompt or metadata', () => { for(const field of ['card','class','route','variant','prompt']) expect(()=>parseCardRows(rows().map(r=>({...r,[field]:' '})))).toThrow(); expect(()=>parseCardRows(rows().map((r,i)=>({...r,key:i?'ok'+i:'toString'})))).toThrow(); });
  it('replacement invalidates only the target card, preserving other data and order', () => { const doc = documentFromRows([...rows(),...rows(2)]); doc.cards[0].tasks['card1-0']='old-task'; const updated=replaceCard(doc,1,parseCardRows(rows(1,5))); expect(updated.cards[0].revision).toBe(2); expect(updated.cards[0].tasks).toEqual({}); expect(updated.cards[0].rows.every(r=>!r.pick)).toBe(true); expect(updated.cards[1]).toEqual(doc.cards[1]); expect(exportCardRows(updated)).toHaveLength(8); });
  it('rejects replacing another card number or stealing another card key', () => { const d=documentFromRows([...rows(),...rows(2)]); expect(()=>replaceCard(d,1,rows(2))).toThrow(); expect(()=>replaceCard(d,1,rows().map((r,i)=>({...r,key:i?r.key:'card2-0'})))).toThrow(); });
  it('an imported pick is not ready until its current result completes', () => { const c=documentFromRows(rows()).cards[0]; c.tasks['card1-0']='new'; const t={id:'old',key:'card1-0',jobId:'job',state:'completed',resultUrl:'/old.png',thumbnailUrl:null,error:null,seed:1}; expect(cardIsReady(c,[t])).toBe(false); expect(cardIsReady(c,[{...t,id:'new'}])).toBe(true); expect(cardIsReady(c,[{...t,id:'new',state:'processing'}])).toBe(false); });
  it('validates generation bounds and supports configured text-to-image models', () => { expect(batchImageModels().some(m=>m.id==='krea2-turbo')).toBe(true); expect(()=>validateBatchSettings({modelId:'qwen-image-edit'})).toThrow(); expect(()=>validateBatchSettings({modelId:'krea2-turbo',parameters:{width:1}})).toThrow(); expect(()=>validateBatchSettings({modelId:'krea2-turbo',parameters:{unrecognized:4}})).toThrow(); expect(validateBatchSettings({modelId:'krea2-turbo',parameters:{width:1024,height:1024}}).modelId).toBe('krea2-turbo'); });
});

describe('batch id and whole-batch selection', () => {
  it('accepts the new id format without pick and preserves ids on export', () => {
    const source = rows().map(({ pick: _, ...row }) => ({ ...row, id: 'ante_up' }));
    const parsed = parseCardRows(source); expect(parsed.every(r => !r.pick && r.id === 'ante_up')).toBe(true);
    expect(exportCardRows(documentFromRows(parsed)).map(r => r.id)).toEqual(['ante_up','ante_up','ante_up']);
  });
  it('rejects unsafe, inconsistent and case-colliding card ids', () => {
    for (const id of ['../outside','a/b','a\\b','', 'a.png']) expect(() => parseCardRows(rows().map(r => ({...r,id})))).toThrow();
    expect(() => parseCardRows(rows().map((r,i) => ({...r,id:i?'second':'first'})))).toThrow('inconsistent id');
    expect(() => parseCardRows([...rows().map(r=>({...r,id:'same'})),...rows(2).map(r=>({...r,id:'SAME'}))])).toThrow('Duplicate card id');
  });
  it('single-card replacement cannot steal another card id', () => {
    const document=documentFromRows(parseCardRows([...rows().map(r=>({...r,id:'one'})),...rows(2).map(r=>({...r,id:'two'}))]));
    expect(()=>replaceCard(document,1,parseCardRows(rows().map(r=>({...r,id:'two'}))))).toThrow('another card');
  });
  it('missing selection includes every card, excluding already attempted variants', () => {
    const document=documentFromRows([...rows(),...rows(2,5)]);document.cards[0].tasks['card1-0']='queued-task';
    expect(missingVariantKeys(document)).toEqual(['card1-1','card1-2','card2-0','card2-1','card2-2','card2-3','card2-4']);
  });
});
