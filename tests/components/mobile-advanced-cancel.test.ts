/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({
  initial: {} as Record<string, any>, values: {} as Record<string, any>,
  hydrate: null as null | React.Dispatch<React.SetStateAction<Record<string, any>>>,
  config: { runpod: { endpoints: {} } }, workspace: 'A', model: 'krea2-turbo', write: vi.fn(), push: vi.fn(), settings: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: f.push }) }));
vi.mock('@/components/workspaces/WorkspaceManager', () => ({ default: () => null }));
vi.mock('@/components/mobile/MobileHeader', () => ({ default: () => null }));
vi.mock('@/components/mobile/MobileScreen', () => ({ default: ({ children }: any) => React.createElement('main', null, children) }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => ({
  activeWorkspaceId: f.workspace, settings: f.config, updateSettings: f.settings,
}) }));
vi.mock('@/components/ui/slider', () => ({ Slider: () => null }));
vi.mock('@/components/mobile/create/MobileCreateProvider', () => ({ useMobileCreate: () => {
  const [values, setValues] = React.useState(f.initial);
  f.values = values; f.hydrate = setValues;
  const write = (key: string, value: any) => {
    f.write(key, value); setValues(prev => ({ ...prev, [key]: value }));
  };
  return {
    currentModel: { id: f.model }, parameterValues: values,
    editableParameters: [
      { name: 'lora', type: 'lora-selector', default: '' },
      { name: 'loraWeight', type: 'number', default: 1 },
      { name: 'width', type: 'number', label: 'Width', default: 1024 },
      { name: 'height', type: 'number', label: 'Height', default: 1024 },
      { name: 'seed', type: 'number', default: 0 },
    ],
    handleParameterChange: write,
    handleNumericParameterInput: (key: string, value: string) => write(key, key.startsWith('loraWeight') ? value : value === '' ? '' : Number(value)),
    availableLoras: [{ id: 'new', s3Path: 'fixture/New.safetensors', fileName: 'New.safetensors', fileSize: '1 MB' }],
    isLoadingLoras: false,
  };
} }));
import MobileAdvancedScreen from '@/components/mobile/create/MobileAdvancedScreen';

const saved = () => ({ lora: 'fixture/First.safetensors', loraWeight: -0.75,
  lora2: 'fixture/Second.safetensors', loraWeight2: 0, width: 768, height: 1024, seed: 123 });
const hydrate = async (values: Record<string, any>) => act(async () => { f.hydrate!(values); });
const cancel = () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
const weight = (name = 'lora') => screen.getByRole('textbox', { name: `LoRA ${name} weight` });
beforeEach(() => { vi.stubGlobal('React', React); vi.clearAllMocks(); f.initial = {}; f.workspace = 'A'; f.model = 'krea2-turbo'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('mobile Advanced cancellation after workspace draft hydration', () => {
  it('does not rewrite restored parameters when Cancel follows hydration without edits', async () => {
    render(React.createElement(MobileAdvancedScreen)); await hydrate(saved());
    expect(screen.getByText('First.safetensors')).toBeTruthy(); cancel();
    expect(f.values).toEqual(saved()); expect(f.write).not.toHaveBeenCalled();
    await waitFor(() => expect(f.push).toHaveBeenCalledWith('/m/create'));
  });
  it('restores a cleared LoRA and its weight from hydrated values, not the mount defaults', async () => {
    render(React.createElement(MobileAdvancedScreen)); await hydrate(saved());
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
    expect(f.values.lora).toBe(''); cancel(); expect(f.values).toEqual(saved());
  });
  it('restores dynamic eighth-slot paths and weights outside the declared parameter schema', async () => {
    const values = { ...saved(), lora8: 'fixture/Eighth.safetensors', loraWeight8: 2.5 };
    f.initial = values; render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight('lora8'), { target: { value: '-3.25' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[2]);
    cancel(); expect(f.values).toEqual(values);
  });
  it('undoes a newly added dynamic LoRA without changing existing slots', async () => {
    f.initial = saved(); render(React.createElement(MobileAdvancedScreen));
    fireEvent.click(screen.getByRole('button', { name: 'Add LoRA' }));
    fireEvent.click(screen.getByRole('button', { name: 'New.safetensors 1 MB' }));
    expect(f.values.lora3).toBe('fixture/New.safetensors'); cancel();
    expect(f.values.lora3 ?? '').toBe('');
    for (const [key, value] of Object.entries(saved())) expect(f.values[key]).toEqual(value);
  });
  it('remembers the original weight through repeated edits including temporary invalid input', async () => {
    render(React.createElement(MobileAdvancedScreen)); await hydrate(saved());
    for (const value of ['-', '-2.5', '0']) fireEvent.change(weight(), { target: { value } });
    cancel(); expect(f.values).toEqual(saved());
  });
  it('rolls back a changed zero weight rather than substituting a default', () => {
    f.initial = saved(); render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight('lora2'), { target: { value: '4' } }); cancel();
    expect(f.values.loraWeight2).toBe(0);
  });
  it('does not roll back unrelated provider updates made after editing starts', async () => {
    f.initial = saved(); render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight(), { target: { value: '3' } });
    await hydrate({ ...f.values, seed: 987, width: 512 }); cancel();
    expect(f.values).toEqual({ ...saved(), seed: 987, width: 512 });
  });
  it('keeps edits on Save and uses those saved values on reopening', async () => {
    f.initial = saved(); let view = render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight(), { target: { value: '2.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(f.push).toHaveBeenCalledWith('/m/create'));
    f.initial = f.values; view.unmount(); view = render(React.createElement(MobileAdvancedScreen));
    cancel(); expect(f.values.loraWeight).toBe('2.25');
  });
  it('preserves A and B choices after each workspace remount and hydration', async () => {
    let view = render(React.createElement(MobileAdvancedScreen)); await hydrate(saved());
    view.unmount(); f.workspace = 'B'; view = render(React.createElement(MobileAdvancedScreen));
    const b = { ...saved(), lora: 'fixture/B.safetensors' }; await hydrate(b); cancel(); expect(f.values).toEqual(b);
    view.unmount(); f.workspace = 'A'; render(React.createElement(MobileAdvancedScreen)); await hydrate(saved());
    cancel(); expect(f.values).toEqual(saved());
  });
  it('does not apply a previous workspace edit journal to a new workspace', async () => {
    f.initial = saved(); const view = render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight(), { target: { value: '3' } });
    f.workspace = 'B'; view.rerender(React.createElement(MobileAdvancedScreen));
    const b = { ...saved(), lora: 'fixture/B.safetensors', loraWeight: 5 }; await hydrate(b);
    cancel(); expect(f.values).toEqual(b);
  });
  it('does not apply a previous model edit journal to a different model', async () => {
    f.initial = saved(); const view = render(React.createElement(MobileAdvancedScreen));
    fireEvent.change(weight(), { target: { value: '3' } });
    f.model = 'z-image'; view.rerender(React.createElement(MobileAdvancedScreen));
    const next = { ...saved(), loraWeight: 7 }; await hydrate(next); cancel(); expect(f.values).toEqual(next);
  });
});
