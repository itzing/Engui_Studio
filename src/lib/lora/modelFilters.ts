export type LoraTarget = 'image' | 'video';

export type LoraFileLike = {
  name?: string;
  fileName: string;
  s3Path: string;
};

type LoraComponent = 'high' | 'low' | null;

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, '');
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

function getLoraComponent(lora: LoraFileLike): LoraComponent {
  const text = normalizeToken(`${getFileStem(lora)} ${lora.name || ''}`);
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.includes('high')) return 'high';
  if (tokens.includes('low')) return 'low';
  return null;
}

function getLoraPairKey(lora: LoraFileLike) {
  const parentPath = getParentPath(lora);
  const stem = getFileStem(lora);
  const stemWithoutComponent = normalizeToken(stem)
    .split(/\s+/)
    .filter((token) => token !== 'high' && token !== 'low')
    .join(' ');

  if (parentPath) {
    return `${parentPath.toLowerCase()}::${stemWithoutComponent}`;
  }

  const nameWithoutComponent = normalizeToken(lora.name || '')
    .split(/\s+/)
    .filter((token) => token !== 'high' && token !== 'low')
    .join(' ');

  return nameWithoutComponent || stemWithoutComponent;
}

export function getLoraSearchText(lora: LoraFileLike) {
  return `${lora.fileName || ''} ${lora.name || ''} ${lora.s3Path || ''}`.toLowerCase();
}

export function getVideoLoraPathSet(loras: LoraFileLike[]) {
  const groups = new Map<string, { high: LoraFileLike[]; low: LoraFileLike[] }>();

  for (const lora of loras) {
    const component = getLoraComponent(lora);
    if (!component) continue;

    const key = getLoraPairKey(lora);
    if (!key) continue;

    const group = groups.get(key) || { high: [], low: [] };
    group[component].push(lora);
    groups.set(key, group);
  }

  const videoPaths = new Set<string>();
  for (const group of groups.values()) {
    if (group.high.length === 0 || group.low.length === 0) continue;
    [...group.high, ...group.low].forEach((lora) => videoPaths.add(lora.s3Path));
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
