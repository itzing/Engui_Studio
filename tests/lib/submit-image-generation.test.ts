import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('@/lib/workspaces/client', () => ({ workspaceFetch: mockFetch }));
import { submitImageGeneration } from '@/lib/create/submitImageGeneration';
import { getModelById } from '@/lib/models/modelConfig';

describe('image submission Randomize preference', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, jobId: 'fixture', seed: 777 }), { status: 200 }));
  });

  it.each([[true, true], [false, true], [true, false], [false, false]])(
    'keeps Randomize=%s separate from preselected=%s on the wire and in the client job', async (randomizeSeed, seedIsPreselected) => {
      const result = await submitImageGeneration({
        currentModel: getModelById('z-image')!, prompt: 'Regression fixture', parameterValues: {seed: 777},
        randomizeSeed, seedIsPreselected, activeWorkspaceId: 'fixture-ws',
        settings: {apiKeys: {}, runpod: {endpoints: {}}} as any, imageFile: null, imageFile2: null,
      });
      expect(result.success).toBe(true);
      const [url, request] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/generate');
      expect(request.body.get('randomizeSeed')).toBe(String(randomizeSeed));
      expect(request.body.get('enableCharacterReferences')).toBe('true');
      expect(request.body.get('seedIsPreselected')).toBe(seedIsPreselected ? 'true' : null);
      expect(request.body.get('seed')).toBe('777');
      if (result.success) {
        expect(result.job.options).toMatchObject({randomizeSeed, seed: 777});
        expect(result.job.options).not.toHaveProperty('seedIsPreselected');
      }
    },
  );
});


describe('Krea2 desktop i2i submission',()=>{
 beforeEach(()=>{mockFetch.mockReset();mockFetch.mockResolvedValue(new Response(JSON.stringify({success:true,jobId:'fixture',seed:42}),{status:200}));});
 const base=()=>({currentModel:getModelById('krea2-turbo')!,prompt:'Red cube',parameterValues:{task_type:'image_to_image',denoise:0,seed:42,width:768,height:512,lora8:'/runpod-volume/loras/style.safetensors',loraWeight8:-.5},randomizeSeed:false,activeWorkspaceId:'ws',settings:{apiKeys:{},runpod:{endpoints:{}}} as any,imageFile:new File(['image'],'source.png',{type:'image/png'}),imageFile2:null});
 it('sends an init image, zero denoise, seed and eighth LoRA weight',async()=>{
  expect((await submitImageGeneration(base())).success).toBe(true);
  const body=mockFetch.mock.calls[0][1].body;
  expect(body.get('modelId')).toBe('krea2-turbo');expect(body.get('task_type')).toBe('image_to_image');
  expect(body.get('denoise')).toBe('0');expect(body.get('seed')).toBe('42');expect(body.get('image').name).toBe('source.png');
  expect(body.get('loraWeight8')).toBe('-0.5');
 });
 it('requires a source only in i2i',async()=>{
  expect((await submitImageGeneration({...base(),imageFile:null})).success).toBe(false);expect(mockFetch).not.toHaveBeenCalled();
  expect((await submitImageGeneration({...base(),imageFile:null,parameterValues:{seed:42}})).success).toBe(true);
  expect(mockFetch.mock.calls[0][1].body.has('image')).toBe(false);
 });
 it('does not leak an old source into text mode',async()=>{
  expect((await submitImageGeneration({...base(),parameterValues:{task_type:''}})).success).toBe(true);
  expect(mockFetch.mock.calls[0][1].body.has('image')).toBe(false);
 });
});
