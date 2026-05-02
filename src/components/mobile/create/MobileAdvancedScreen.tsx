'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SlidersHorizontal } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/toast';
import { useStudio } from '@/lib/context/StudioContext';
import { MODELS } from '@/lib/models/modelConfig';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';

export default function MobileAdvancedScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useStudio();
  const { showToast } = useToast();
  const {
    currentModel,
    editableParameters,
    parameterValues,
    handleParameterChange,
    handleNumericParameterInput,
    availableLoras,
    isLoadingLoras,
  } = useMobileCreate();
  const [showLoraSelector, setShowLoraSelector] = useState(false);
  const [endpointDrafts, setEndpointDrafts] = useState<Record<string, string>>({});
  const [weightToast, setWeightToast] = useState<string | null>(null);
  const initialEndpointDraftsRef = useRef<Record<string, string>>({});
  const initialParameterValuesRef = useRef<Record<string, any>>({});
  const latestEndpointDraftsRef = useRef<Record<string, string>>({});
  const latestSettingsRef = useRef(settings);
  const weightToastTimerRef = useRef<number | null>(null);

  const runpodModels = useMemo(() => {
    return MODELS.filter((model) => model.api.type === 'runpod');
  }, []);

  useEffect(() => {
    const nextEndpoints = settings.runpod?.endpoints || {};
    setEndpointDrafts(nextEndpoints);
    initialEndpointDraftsRef.current = nextEndpoints;
  }, [settings.runpod?.endpoints]);

  useEffect(() => {
    latestEndpointDraftsRef.current = endpointDrafts;
  }, [endpointDrafts]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    initialParameterValuesRef.current = Object.fromEntries(
      editableParameters.map((param) => [param.name, parameterValues[param.name]])
    );
  }, []);

  useEffect(() => {
    return () => {
      if (weightToastTimerRef.current !== null) {
        window.clearTimeout(weightToastTimerRef.current);
      }
    };
  }, []);

  const zImageAddCap = 8;
  const configuredLoraParamNames = useMemo(() => {
    return editableParameters.filter((param) => param.type === 'lora-selector').map((param) => param.name);
  }, [editableParameters]);
  const dynamicLoraParamNames = useMemo(() => {
    const names = new Set<string>(configuredLoraParamNames);
    Object.keys(parameterValues)
      .filter((key) => /^lora\d*$/.test(key) && !/^loraWeight\d*$/.test(key))
      .forEach((key) => names.add(key));
    return Array.from(names).sort((a, b) => {
      const getIndex = (value: string) => value === 'lora' ? 1 : Number.parseInt(value.slice(4), 10);
      return getIndex(a) - getIndex(b);
    });
  }, [configuredLoraParamNames, parameterValues]);
  const loraWeightByName = useMemo(() => {
    const map: Record<string, string> = {};
    dynamicLoraParamNames.forEach((name) => {
      const suffix = name === 'lora' ? '' : name.slice(4);
      map[name] = suffix ? `loraWeight${suffix}` : 'loraWeight';
    });
    return map;
  }, [dynamicLoraParamNames]);

  const widthParam = editableParameters.find((param) => param.name === 'width');
  const heightParam = editableParameters.find((param) => param.name === 'height');
  const stepsParam = editableParameters.find((param) => param.name === 'steps');
  const cfgParam = editableParameters.find((param) => param.name === 'cfg' || param.name === 'cfg_scale');

  const visibleParameters = editableParameters.filter((param) => {
    if (param.name === 'negativePrompt' || param.name === 'negative_prompt') return false;
    if (param.name === 'use_controlnet') return false;
    if (param.name === 'seed') return false;
    if (param.name === 'width' || param.name === 'height') return false;
    if (param.name === 'steps' || param.name === 'cfg' || param.name === 'cfg_scale') return false;
    if (param.type === 'lora-selector') return false;
    if (/^loraWeight\d*$/.test(param.name)) return false;
    return true;
  });

  const selectedLoraSlots = dynamicLoraParamNames
    .map((paramName) => {
      const path = String(parameterValues[paramName] ?? '').trim();
      if (!path) return null;
      const matchedLoRA = availableLoras.find((lora) => lora.s3Path === path);
      const weightParamName = loraWeightByName[paramName];
      const rawWeight = weightParamName ? parameterValues[weightParamName] : undefined;
      const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight ?? 1);
      return {
        paramName,
        path,
        matchedLoRA,
        weightParamName,
        weight: Number.isFinite(weight) ? weight : 1,
      };
    })
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null);

  const nextEmptyLoraParam = useMemo(() => {
    for (let i = 1; i <= zImageAddCap; i += 1) {
      const name = i === 1 ? 'lora' : `lora${i}`;
      if (!String(parameterValues[name] ?? '').trim()) {
        return name;
      }
    }
    return null;
  }, [parameterValues]);

  const persistEndpointDrafts = (drafts: Record<string, string>, showSavedToast = false) => {
    const currentSettings = latestSettingsRef.current;
    const currentEndpoints = currentSettings.runpod?.endpoints || {};
    const hasChanges = runpodModels.some((model) => (drafts[model.id] ?? '') !== (currentEndpoints[model.id] ?? ''));

    if (!hasChanges) {
      return false;
    }

    updateSettings({
      runpod: {
        ...currentSettings.runpod,
        endpoints: {
          ...currentEndpoints,
          ...drafts,
        },
      },
    });

    if (showSavedToast) {
      showToast('Endpoint IDs saved', 'success', 1800);
    }

    return true;
  };

  const saveEndpointDrafts = (showSavedToast = true) => {
    return persistEndpointDrafts(latestEndpointDraftsRef.current, showSavedToast);
  };

  const handleCancel = () => {
    editableParameters.forEach((param) => {
      const initialValue = initialParameterValuesRef.current[param.name];
      handleParameterChange(param.name, initialValue ?? param.default ?? '');
    });

    updateSettings({
      runpod: {
        ...latestSettingsRef.current.runpod,
        endpoints: {
          ...initialEndpointDraftsRef.current,
        },
      },
    });

    router.push('/m/create');
  };

  const handleSave = () => {
    saveEndpointDrafts(false);
    router.push('/m/create');
  };

  const showWeightToast = (value: number) => {
    setWeightToast(`Weight set to ${value}`);
    if (weightToastTimerRef.current !== null) {
      window.clearTimeout(weightToastTimerRef.current);
    }
    weightToastTimerRef.current = window.setTimeout(() => {
      setWeightToast(null);
      weightToastTimerRef.current = null;
    }, 1400);
  };

  return (
    <MobileScreen>
      {weightToast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-lg border border-primary/30 bg-background/95 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur">
          {weightToast}
        </div>
      ) : null}
      <MobileHeader title="Advanced" subtitle="Fine tune visible parameters for the current image model." />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 custom-scrollbar">
        <div className="space-y-4">
          {dynamicLoraParamNames.length > 0 ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                {selectedLoraSlots.map((slot) => (
                  <div key={slot.paramName} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {slot.matchedLoRA?.fileName || slot.path.split('/').pop() || slot.path}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Weight {slot.weight.toFixed(2)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleParameterChange(slot.paramName, '');
                          if (slot.weightParamName) {
                            handleParameterChange(slot.weightParamName, 1);
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    {slot.weightParamName ? (
                      <div className="space-y-2">
                        <Slider
                          value={[Math.max(-3, Math.min(3, slot.weight))]}
                          min={-3}
                          max={3}
                          step={0.05}
                          onValueChange={(value) => handleParameterChange(slot.weightParamName, value[0] ?? 1)}
                        />
                        <div className="grid grid-cols-7 gap-1">
                          {[-3, -2, -1, 0, 1, 2, 3].map((mark) => (
                            <button
                              key={mark}
                              type="button"
                              className={`rounded-md border px-1 py-1 text-[11px] transition-colors ${Math.abs(slot.weight - mark) < 0.001 ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-accent/40'}`}
                              onClick={() => {
                                handleParameterChange(slot.weightParamName, mark);
                                showWeightToast(mark);
                              }}
                            >
                              {mark}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}

                {nextEmptyLoraParam ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowLoraSelector(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add LoRA
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {widthParam && heightParam ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">{widthParam.label}</div>
                    <Input
                      type="number"
                      value={parameterValues[widthParam.name] ?? widthParam.default ?? ''}
                      min={widthParam.min}
                      max={widthParam.max}
                      step={widthParam.step}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleNumericParameterInput(widthParam.name, event.target.value)}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">{heightParam.label}</div>
                    <Input
                      type="number"
                      value={parameterValues[heightParam.name] ?? heightParam.default ?? ''}
                      min={heightParam.min}
                      max={heightParam.max}
                      step={heightParam.step}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleNumericParameterInput(heightParam.name, event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {stepsParam && cfgParam ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">{stepsParam.label}</div>
                    <Input
                      type="number"
                      value={parameterValues[stepsParam.name] ?? stepsParam.default ?? ''}
                      min={stepsParam.min}
                      max={stepsParam.max}
                      step={stepsParam.step}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleNumericParameterInput(stepsParam.name, event.target.value)}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">{cfgParam.label}</div>
                    <Input
                      type="number"
                      value={parameterValues[cfgParam.name] ?? cfgParam.default ?? ''}
                      min={cfgParam.min}
                      max={cfgParam.max}
                      step={cfgParam.step}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleNumericParameterInput(cfgParam.name, event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Dialog open={showLoraSelector} onOpenChange={setShowLoraSelector}>
            <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0">
              <DialogHeader className="border-b px-4 py-4">
                <DialogTitle>Select LoRA</DialogTitle>
              </DialogHeader>
              <div className="max-h-[65dvh] overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                  {isLoadingLoras ? (
                    <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">Loading LoRAs...</div>
                  ) : availableLoras.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No LoRAs installed yet.
                    </div>
                  ) : (
                    availableLoras.map((lora) => (
                      <button
                        key={lora.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-3 text-left hover:border-primary/40 hover:bg-primary/5"
                        onClick={() => {
                          if (!nextEmptyLoraParam) return;
                          handleParameterChange(nextEmptyLoraParam, lora.s3Path);
                          const weightParamName = loraWeightByName[nextEmptyLoraParam];
                          if (weightParamName && (parameterValues[weightParamName] === undefined || parameterValues[weightParamName] === '')) {
                            handleParameterChange(weightParamName, 1);
                          }
                          setShowLoraSelector(false);
                        }}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="truncate text-sm font-medium text-foreground">{lora.fileName}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{lora.fileSize}</div>
                        </div>
                        <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {visibleParameters.map((param) => {
            const value = parameterValues[param.name] ?? param.default;
            return (
              <Card key={param.name}>
                <CardContent className="space-y-3 pt-6">
                  <div className="text-lg font-semibold text-foreground">{param.label}</div>
                  {param.description ? <p className="text-xs text-muted-foreground">{param.description}</p> : null}

                  {param.type === 'boolean' ? (
                    <Button variant={value ? 'default' : 'outline'} size="sm" onClick={() => handleParameterChange(param.name, !(value ?? false))}>
                      {value ? 'Enabled' : 'Disabled'}
                    </Button>
                  ) : param.type === 'select' ? (
                    <select
                      value={value ?? ''}
                      onChange={(event) => handleParameterChange(param.name, event.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-base text-white sm:text-sm"
                    >
                      {param.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : param.type === 'number' ? (
                    <Input
                      type="number"
                      value={value ?? ''}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleNumericParameterInput(param.name, event.target.value)}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={value ?? ''}
                      className="text-base sm:text-sm"
                      onChange={(event) => handleParameterChange(param.name, event.target.value)}
                      placeholder={param.type === 'lora-selector' ? 'LoRA path or name' : undefined}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="text-lg font-semibold text-foreground">Endpoint IDs</div>
              <div className="space-y-2">
                {runpodModels.map((model) => (
                  <div key={model.id} className={`rounded-lg border px-3 py-2 ${model.id === currentModel?.id ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/40'}`}>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">{model.id}</div>
                    <Input
                      value={endpointDrafts[model.id] ?? settings.runpod.endpoints[model.id] ?? model.api.endpoint ?? ''}
                      className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                      onChange={(event) => setEndpointDrafts((prev) => ({ ...prev, [model.id]: event.target.value }))}
                      placeholder={model.api.endpoint}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="z-20 shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>
          <Button size="lg" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </MobileScreen>
  );
}
