export type LoraTarget = 'image' | 'video';

export type LoraFileLike = {
  name?: string;
  fileName: string;
  s3Path: string;
};

type LoraComponent = 'high' | 'low' | null;

export type LoraPair<T extends LoraFileLike> = {
  key: string;
  baseName: string;
  high?: T;
  low?: T;
  isComplete: boolean;
};

function stripExtension(value: string) {
  return value.replace(/\.(safetensors|ckpt)$/i, '');
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getFileStem(lora: LoraFileLike) {
  const fileName = lora.fileName || lora.s3Path.split('/').pop() || lora.name || '';
  return stripExtension(fileName);
}

function getParentPath(lora: LoraFileLike) {
  const path = lora.s3Path || '';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return '';
  return parts.slice(0, -1).join('/');
}

function getParentName(lora: LoraFileLike) {
  const parentPath = getParentPath(lora);
  const parts = parentPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function getLoraComponent(lora: LoraFileLike): LoraComponent {
  const text = normalizeToken(`${getFileStem(lora)} ${lora.name || ''}`);
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => token === 'high' || token === 'highnoise')) return 'high';
  if (tokens.some((token) => token === 'low' || token === 'lownoise')) return 'low';
  return null;
}

function isPairComponentToken(token: string) {
  return token === 'high' || token === 'low' || token === 'highnoise' || token === 'lownoise' || token === 'noise';
}

function getLoraPairKey(lora: LoraFileLike) {
  const parentPath = getParentPath(lora);
  const stem = getFileStem(lora);
  const stemWithoutComponent = normalizeToken(stem)
    .split(/\s+/)
    .filter((token) => !isPairComponentToken(token))
    .join(' ');

  if (parentPath) {
    return `${parentPath.toLowerCase()}::${stemWithoutComponent}`;
  }

  const nameWithoutComponent = normalizeToken(stripExtension(lora.name || ''))
    .split(/\s+/)
    .filter((token) => !isPairComponentToken(token))
    .join(' ');

  return nameWithoutComponent || stemWithoutComponent;
}

function getLoraPairBaseName(lora: LoraFileLike) {
  const parentName = getParentName(lora);
  if (parentName && parentName.toLowerCase() !== 'loras') {
    return parentName;
  }

  const nameWithoutComponent = normalizeToken(stripExtension(lora.name || ''))
    .split(/\s+/)
    .filter((token) => !isPairComponentToken(token))
    .join(' ');
  if (nameWithoutComponent) return nameWithoutComponent;

  return normalizeToken(getFileStem(lora))
    .split(/\s+/)
    .filter((token) => !isPairComponentToken(token))
    .join(' ');
}

export function getLoraSearchText(lora: LoraFileLike) {
  return `${lora.fileName || ''} ${lora.name || ''} ${lora.s3Path || ''}`.toLowerCase();
}

export function buildLoraPairs<T extends LoraFileLike>(loras: T[]) {
  const pairs = new Map<string, LoraPair<T>>();

  for (const lora of loras) {
    const component = getLoraComponent(lora);
    if (!component) continue;

    const key = getLoraPairKey(lora);
    if (!key) continue;

    const pair = pairs.get(key) || {
      key,
      baseName: getLoraPairBaseName(lora),
      high: undefined,
      low: undefined,
      isComplete: false,
    };

    pair[component] = lora;
    pair.isComplete = !!(pair.high && pair.low);
    pairs.set(key, pair);
  }

  return Array.from(pairs.values()).sort((a, b) => {
    if (a.isComplete && !b.isComplete) return -1;
    if (!a.isComplete && b.isComplete) return 1;
    return a.baseName.localeCompare(b.baseName);
  });
}

export function getVideoLoraPathSet(loras: LoraFileLike[]) {
  const videoPaths = new Set<string>();
  for (const pair of buildLoraPairs(loras)) {
    if (!pair.high || !pair.low) continue;
    videoPaths.add(pair.high.s3Path);
    videoPaths.add(pair.low.s3Path);
  }

  return videoPaths;
}

export function filterLorasForTarget<T extends LoraFileLike>(loras: T[], target: LoraTarget) {
  const videoPaths = getVideoLoraPathSet(loras);
  return loras.filter((lora) => target === 'video' ? videoPaths.has(lora.s3Path) : !videoPaths.has(lora.s3Path));
}

export function filterLorasForModel<T extends LoraFileLike>(loras: T[], modelId: string) {
  if (modelId === 'wan22') {
    return filterLorasForTarget(loras, 'video');
  }

  return filterLorasForTarget(loras, 'image');
}
