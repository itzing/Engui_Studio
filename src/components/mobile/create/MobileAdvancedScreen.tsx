'use client';

import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';

export default function MobileAdvancedScreen() {
  const {
    currentModel,
    editableParameters,
    parameterValues,
    handleParameterChange,
    handleNumericParameterInput,
    randomizeSeed,
    setRandomizeSeed,
  } = useMobileCreate();

  const visibleParameters = editableParameters.filter((param) => param.name !== 'negativePrompt' && param.name !== 'negative_prompt');

  return (
    <MobileScreen>
      <MobileHeader title="Advanced" subtitle="Fine tune visible parameters for the current image model." backHref="/m/create" />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Current model</CardDescription>
              <CardTitle className="text-lg">{currentModel?.name || 'Loading model...'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Randomize seed</span>
                <Button variant={randomizeSeed ? 'default' : 'outline'} size="sm" onClick={() => setRandomizeSeed(!randomizeSeed)}>
                  {randomizeSeed ? 'On' : 'Off'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {visibleParameters.map((param) => {
            const value = parameterValues[param.name] ?? param.default;
            return (
              <Card key={param.name}>
                <CardHeader className="pb-3">
                  <CardDescription>{param.group || 'advanced'}</CardDescription>
                  <CardTitle className="text-lg">{param.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
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
