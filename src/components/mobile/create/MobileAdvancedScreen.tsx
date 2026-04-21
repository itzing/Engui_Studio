'use client';

import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';

export default function MobileAdvancedScreen() {
  const {
    editableParameters,
    parameterValues,
    handleParameterChange,
    handleNumericParameterInput,
    availableLoras,
    isLoadingLoras,
  } = useMobileCreate();
  const [showLoraSelector, setShowLoraSelector] = useState(false);

  const loraParams = editableParameters.filter((param) => param.type === 'lora-selector');
  const loraWeightByName = useMemo(() => {
    const map: Record<string, string> = {};
    editableParameters
      .filter((param) => /^loraWeight\d*$/.test(param.name))
      .forEach((param) => {
        const suffix = param.name.replace('loraWeight', '');
        const loraName = suffix ? `lora${suffix}` : 'lora';
        map[loraName] = param.name;
      });
    return map;
  }, [editableParameters]);

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

  const selectedLoraSlots = loraParams
    .map((param) => {
      const path = String(parameterValues[param.name] ?? '').trim();
      if (!path) return null;
      const matchedLoRA = availableLoras.find((lora) => lora.s3Path === path);
      const weightParamName = loraWeightByName[param.name];
      const rawWeight = weightParamName ? parameterValues[weightParamName] : undefined;
      const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight ?? 1);
      return {
        param,
        path,
        matchedLoRA,
        weightParamName,
        weight: Number.isFinite(weight) ? weight : 1,
      };
    })
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null);

  const nextEmptyLoraParam = loraParams.find((param) => !String(parameterValues[param.name] ?? '').trim());

  return (
    <MobileScreen>
      <MobileHeader title="Advanced" subtitle="Fine tune visible parameters for the current image model." backHref="/m/create" />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          {loraParams.length > 0 ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                {selectedLoraSlots.map((slot) => (
                  <div key={slot.param.name} className="rounded-lg border border-border/60 bg-background/40 p-3">
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
                          handleParameterChange(slot.param.name, '');
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
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>-3</span>
                          <span>0</span>
                          <span>3</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}

                {loraParams.length < 4 && nextEmptyLoraParam ? (
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
                          handleParameterChange(nextEmptyLoraParam.name, lora.s3Path);
                          const weightParamName = loraWeightByName[nextEmptyLoraParam.name];
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
        </div>
      </div>
    </MobileScreen>
  );
}
