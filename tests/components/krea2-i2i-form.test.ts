/** @vitest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen, cleanup, waitFor, act } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const { submit, phone, draft, media }=vi.hoisted(()=>({submit:vi.fn(),phone:{value:false},draft:{props:null as any},media:{store:vi.fn(),resolve:vi.fn()}}));
vi.mock('@/lib/workspaces/useWorkspaceFetch',()=>{const f=(...a:any[]) => (globalThis.fetch as any)(...a);return {useWorkspaceFetch:()=>f};});
vi.mock('@/lib/context/StudioContext',()=>({useStudio:()=>({settings:{promptHelper:{provider:'disabled',local:{}},visionPromptHelper:{provider:'disabled',local:{}},apiKeys:{},runpod:{endpoints:{}}},addJob:vi.fn(),activeWorkspaceId:'ws-1'})}));
vi.mock('@/lib/i18n/context',()=>({useI18n:()=>({t:(k:string)=>k})}));
vi.mock('@/lib/models/modelConfig',async(importOriginal)=>{const m=await importOriginal<any>();return {...m,getModelsByType:()=>[m.getModelById('krea2-turbo')]};});
vi.mock('@/lib/create/submitImageGeneration',()=>({submitImageGeneration:submit}));
vi.mock('@/hooks/create/useImageCreateDraftPersistence',()=>({useImageCreateDraftPersistence:(props:any)=>{draft.props=props;return {switchModel:vi.fn(),hasRestoredDraftRef:{current:true}};}}));
vi.mock('@/components/lora/LoRASelector',()=>({LoRASelector:()=>null}));
vi.mock('@/components/lora/LoRAManagementDialog',()=>({LoRAManagementDialog:()=>null}));
vi.mock('@/components/prompt-wildcards/PromptTemplateTextarea',()=>({default:(p:any)=>React.createElement("textarea",{"data-testid":p.testId,value:p.value,onChange:(e:any)=>p.onChange(e.target.value)})}));
vi.mock('@/lib/create/imagePromptHelper',()=>({requestImagePromptImprovement:vi.fn(),requestZImagePromptRewrite:vi.fn(),extractImagePromptFromDataUrl:vi.fn()}));
vi.mock('@/lib/create/createMediaStore',()=>({storeCreateFile:media.store,resolveCreateMediaRefToFile:media.resolve}));
import ImageGenerationForm from '@/components/forms/ImageGenerationForm';
beforeEach(()=>{
 phone.value=false;media.store.mockResolvedValue({kind:'idb-media',mediaId:'source-id'});media.resolve.mockResolvedValue(new File(['image'],'restored.png',{type:'image/png'}));submit.mockReset();submit.mockResolvedValue({success:true,job:{id:'fixture',modelId:'krea2-turbo',type:'image',status:'queued',prompt:'Red cube',createdAt:0,options:{}},nextSeed:null});
 Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn().mockImplementation(()=>({matches:phone.value,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({success:true,documents:[],vibes:[],wildcards:[],loras:[],characters:[]})})));
 vi.stubGlobal('Image',class {width=700;height=500;onload?:()=>void;set src(_s:string){this.onload?.();}});
 URL.createObjectURL=vi.fn(()=> 'blob:source');URL.revokeObjectURL=vi.fn();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('offers Text/I2I but not Control and preserves prompt when source is uploaded',async()=>{
 const {container}=render(React.createElement(ImageGenerationForm));
 expect(await screen.findByRole('button',{name:'I2I'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Control'})).toBeNull();
 expect(screen.queryByText('Init Image (Required)')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'I2I'}));
 const prompt=screen.getByTestId('image-create-prompt-textarea') as HTMLTextAreaElement;
 fireEvent.change(prompt,{target:{value:'Red cube'}});
 const file=new File(['synthetic'],'source.png',{type:'image/png'});
 fireEvent.change(container.querySelector('input[type="file"][accept="image/*"]')!,{target:{files:[file]}});
 expect(prompt.value).toBe('Red cube');
 fireEvent.submit(container.querySelector('form')!);
 await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
 expect(submit.mock.calls[0][0]).toMatchObject({imageFile:file,prompt:'Red cube',parameterValues:{task_type:'image_to_image',denoise:.35,width:704,height:512}});
 expect(submit.mock.calls[0][0].parameterValues).not.toHaveProperty('use_controlnet');
});
it('switches back to Text without removing LoRA-independent prompt',async()=>{
 const {container}=render(React.createElement(ImageGenerationForm));
 fireEvent.click(await screen.findByRole('button',{name:'I2I'}));
 fireEvent.change(screen.getByTestId('image-create-prompt-textarea'),{target:{value:'A cube'}});
 fireEvent.click(screen.getByRole('button',{name:'Text'}));
 expect(screen.queryByText('Init Image (Required)')).toBeNull();
 fireEvent.submit(container.querySelector('form')!);
 await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
 expect(submit.mock.calls[0][0].parameterValues.task_type).toBe('');
});
it('does not introduce the desktop mode switch on phone layout',async()=>{
 phone.value=true;render(React.createElement(ImageGenerationForm));
 await screen.findByTestId('image-create-prompt-textarea');
 expect(screen.queryByRole('button',{name:'I2I'})).toBeNull();
});

it('saves a durable source ref and restores usable bytes rather than a stale blob URL',async()=>{
 const {container}=render(React.createElement(ImageGenerationForm));
 fireEvent.click(await screen.findByRole('button',{name:'I2I'}));
 const file=new File(['synthetic'],'source.png',{type:'image/png'});
 fireEvent.change(container.querySelector('input[type="file"][accept="image/*"]')!,{target:{files:[file]}});
 await waitFor(()=>expect(draft.props.snapshot.inputs.primary).toMatchObject({kind:'idb-media',mediaId:'source-id'}));
 const snapshot={...draft.props.snapshot,prompt:'Restored cube',previewUrl:'blob:expired'};
 await act(async()=>draft.props.applySnapshot('krea2-turbo',snapshot));
 expect(media.resolve).toHaveBeenCalledWith(snapshot.inputs.primary);
 fireEvent.submit(container.querySelector('form')!);
 await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
 expect(submit.mock.calls[0][0].imageFile.name).toBe('restored.png');
});
