type PromptHelperDebug = {
  content?: string;
  reasoningContent?: string;
};

export type ImagePromptHelperResult = {
  improvedPrompt: string;
  improvedNegativePrompt?: string;
  debug?: PromptHelperDebug;
};

export const requestImagePromptImprovement = async (payload: {
  prompt: string;
  negativePrompt?: string;
  instruction: string;
  modelId: string;
  width?: number;
  height?: number;
}): Promise<ImagePromptHelperResult> => {
  const response = await fetch('/api/prompt-helper/improve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok || !text.trim()) {
    throw new Error(text.trim() || 'Prompt Helper request failed');
  }

  return {
    improvedPrompt: text.trim(),
  };
};

export const requestZImagePromptRewrite = async (payload: {
  prompt: string;
}): Promise<string> => {
  const response = await fetch('/api/prompt-helper/z-image-rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok || !text.trim()) {
    throw new Error(text.trim() || 'Z-Image prompt rewrite failed');
  }

  return text.trim();
};

export const extractImagePromptFromDataUrl = async (payload: {
  imageDataUrl: string;
  modelId: string;
  instruction: string;
}): Promise<string> => {
  const response = await fetch('/api/vision-prompt-helper/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success || !data.prompt) {
    throw new Error(data.error || 'Image to prompt extraction failed');
  }

  return data.prompt;
};
