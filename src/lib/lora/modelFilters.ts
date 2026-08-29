export type LoraTarget = 'image' | 'video';
export type LoraBaseModel = 'wan2.2' | 'z-image' | 'krea2-turbo';

export const LORA_BASE_MODELS: Array<{ value: LoraBaseModel; label: string; target: LoraTarget }> = [
  { value: 'wan2.2', label: 'Wan 2.2', target: 'video' },
  { value: 'z-image', label: 'Z-Image Turbo', target: 'image' },
  { value: 'krea2-turbo', label: 'Krea2 Turbo', target: 'image' },
];

export type LoraFileLike = {
  name?: string;
  fileName: string;
  s3Path: string;
  targetOverride?: 'image' | 'video' | string | null;
  baseModel?: LoraBaseModel | string | null;
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

function getExplicitTarget(lora: LoraFileLike): LoraTarget | null {
  return lora.targetOverride === 'image' || lora.targetOverride === 'video'
    ? lora.targetOverride
    : null;
}

export function getExplicitBaseModel(lora: LoraFileLike): LoraBaseModel | null {
  return lora.baseModel === 'wan2.2' || lora.baseModel === 'z-image' || lora.baseModel === 'krea2-turbo'
    ? lora.baseModel
    : null;
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
  for (const lora of loras) {
    const targetOverride = getExplicitTarget(lora);
    if (targetOverride === 'video') {
      videoPaths.add(lora.s3Path);
      continue;
    }
    if (targetOverride === 'image') {
      continue;
    }

    const baseModel = getExplicitBaseModel(lora);
    if (baseModel === 'wan2.2') {
      videoPaths.add(lora.s3Path);
    }
  }

  for (const pair of buildLoraPairs(loras)) {
    if (!pair.high || !pair.low) continue;
    if (
      getExplicitTarget(pair.high) ||
      getExplicitTarget(pair.low) ||
      getExplicitBaseModel(pair.high) ||
      getExplicitBaseModel(pair.low)
    ) {
      continue;
    }
    videoPaths.add(pair.high.s3Path);
    videoPaths.add(pair.low.s3Path);
  }

  return videoPaths;
}

export function filterLorasForTarget<T extends LoraFileLike>(loras: T[], target: LoraTarget) {
  const videoPaths = getVideoLoraPathSet(loras);
  return loras.filter((lora) => {
    if (lora.targetOverride === target) return true;
    if (target === 'video') return videoPaths.has(lora.s3Path);
    return !videoPaths.has(lora.s3Path);
  });
}

export function filterLorasForModel<T extends LoraFileLike>(loras: T[], modelId: string) {
  if (modelId === 'wan22' || modelId === 'wan22-t2v') {
    const videoLoras = filterLorasForTarget(loras, 'video');
    const wanLoras = loras.filter((lora) => lora.baseModel === 'wan2.2');
    const byPath = new Map<string, T>();
    [...videoLoras, ...wanLoras].forEach((lora) => byPath.set(lora.s3Path, lora));
    return Array.from(byPath.values());
  }

  if (modelId === 'krea2-turbo') {
    return filterLorasForTarget(loras, 'image').filter((lora) => lora.baseModel === 'krea2-turbo');
  }

  if (modelId === 'z-image') {
    return filterLorasForTarget(loras, 'image').filter((lora) => !lora.baseModel || lora.baseModel === 'z-image');
  }

  return filterLorasForTarget(loras, 'image');
}
