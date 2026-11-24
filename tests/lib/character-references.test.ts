import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ character: { findMany: vi.fn() }, promptWildcard: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
import { createInitialSceneTemplateState, renderSceneTemplateV2 } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
import { renderCreatePrompt } from '@/lib/generation/renderCreatePrompt';
import { workspaceContext } from '@/lib/workspaces/context';
import { characterReferenceToken, protectCharacterReferences } from '@/lib/character-references/tokens';
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const token = characterReferenceToken(id);
const clothed = characterReferenceToken(id, true);
const date = new Date('2026-11-24T12:00:00Z');
let record: any;
const render = (prompt: string, extra: any = {}) => workspaceContext.run({ kind: 'workspace', workspaceId: 'ws-1' }, () => renderCreatePrompt({ prompt, workspaceId: 'ws-1', seed: 42, ...extra }));
beforeEach(() => {
  vi.clearAllMocks();
  record = { id, workspaceId: 'ws-1', name: 'Alice', gender: 'female', traits: JSON.stringify({ age: '30', hair_color: 'red', dress: 'legacy green dress' }), editorState: '{}', currentVersionId: 'version-1', createdAt: date, updatedAt: date, deletedAt: null, defaultOutfitId: 'outfit-1', defaultOutfit: { id: 'outfit-1', workspaceId: 'ws-1', ownerCharacterId: id, name: 'Default', description: 'blue jacket', constraints: 'silver buttons', revision: 2, deletedAt: null } };
  db.character.findMany.mockImplementation(async () => [structuredClone(record)]);
  db.promptWildcard.findMany.mockResolvedValue([]);
});
describe('Create Character references', () => {
  it('leaves Character tags literal in Prompt Constructor', () => {
    const state = createInitialSceneTemplateState(); state.sceneSummary.mainEvent = token;
    expect(renderSceneTemplateV2(state, [])).toContain(token);
    expect(db.character.findMany).not.toHaveBeenCalled();
  });
  it('does not look up characters for ordinary prompts', async () => {
    expect((await render('A portrait with {red|blue} light')).prompt).toMatch(/^A portrait with (red|blue) light$/);
    expect(db.character.findMany).not.toHaveBeenCalled();
  });
  it('inserts identity without any default or legacy costume', async () => {
    const result = await render(`Portrait of ${token}.`);
    expect(result.prompt).toContain('Alice'); expect(result.prompt).toContain('red');
    expect(result.prompt).not.toMatch(/jacket|dress|buttons/);
    expect(result.characterReferences[0]).toMatchObject({ characterId: id, includeOutfit: false, outfitId: null, characterVersionId: 'version-1' });
    expect(db.character.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [id] }, workspaceId: 'ws-1', deletedAt: null } }));
  });
  it('adds current default outfit with provenance', async () => {
    const result = await render(clothed);
    expect(result.prompt).toContain('blue jacket. silver buttons');
    expect(result.characterReferences[0]).toMatchObject({ outfitId: 'outfit-1', outfitRevision: 2, includeOutfit: true });
  });
  it('resolves repeated references from one lookup without changing their positions', async () => {
    const result = await render(`A: ${token}; B: ${clothed}; C: ${token}`);
    expect(db.character.findMany).toHaveBeenCalledTimes(1);
    expect(result.characterReferences).toHaveLength(2);
    expect(result.prompt.split('Alice')).toHaveLength(4);
  });
  it('uses current character/outfit on another render without mutating old results', async () => {
    const previous = await render(clothed);
    record.traits = JSON.stringify({ hair_color: 'blonde' }); record.currentVersionId = 'version-2';
    record.defaultOutfit.description = 'black coat'; record.defaultOutfit.revision = 3;
    const current = await render(clothed);
    expect(current.prompt).toContain('blonde'); expect(current.prompt).toContain('black coat');
    expect(current.characterReferences[0].characterVersionId).toBe('version-2');
    expect(previous.prompt).toContain('red'); expect(previous.prompt).toContain('blue jacket');
    expect(previous.characterReferences[0].outfitRevision).toBe(2);
  });
  it('keeps braces and dollar signs in a Character literal, with no recursive expansion', async () => {
    record.traits = JSON.stringify({ note: `{blue|green} $& ${characterReferenceToken(otherId)}` });
    const result = await render(token);
    expect(result.prompt).toContain(`{blue|green} $& ${characterReferenceToken(otherId)}`);
    expect(db.character.findMany).toHaveBeenCalledTimes(1);
  });
  it('supports references inside wildcard values and seeded alternatives', async () => {
    db.promptWildcard.findMany.mockResolvedValue([{ key: 'actor', name: 'Actor', value: token }]);
    const result = await render('{actor}, {sun|rain}');
    expect(result.prompt).toMatch(/Alice.*(sun|rain)$/);
    for (let seed = 0; seed < 10; seed++) {
      const choice = await render(`{${token}|empty room}`, { seed });
      expect(choice.prompt).not.toContain('{');
      expect(choice.prompt === 'empty room' || choice.prompt.includes('Alice')).toBe(true);
    }
  });
  it('does not let a wildcard called character consume the explicit token', async () => {
    db.promptWildcard.findMany.mockResolvedValue([{ key: 'character', name: 'Character', value: `{${id}|bad}` }]);
    expect((await render(token)).prompt).toContain('Alice');
  });
  it('preserves sequential cursor semantics and does not mutate incoming selections', async () => {
    db.promptWildcard.findMany.mockResolvedValue([{ key: 'light', name: 'Light', value: '{sun|rain}' }]);
    const selections = { light: { indices: [0, 1], mode: 'sequential', startIndex: 0, cursor: 0 } };
    const first = await render(`${token}, {light:0,1}`, { selections });
    const second = await render(`${token}, {light:0,1}`, { selections });
    expect(first.prompt).toBe(second.prompt); expect(first.prompt).toContain('sun');
    expect(first.selections.light.cursor).toBe(1); expect(selections.light.cursor).toBe(0);
  });
  it.each(['{character:bad}', `{character:${id}:wrong}`, `{character:${id}`, '{character:}'])('rejects malformed reference %s', async input => {
    await expect(render(input)).rejects.toMatchObject({ status: 422 });
    expect(db.character.findMany).not.toHaveBeenCalled();
  });
  it.each(['missing', 'deleted', 'foreign'])('rejects %s characters', async mode => {
    if (mode === 'missing') db.character.findMany.mockResolvedValue([]);
    if (mode === 'deleted') record.deletedAt = date;
    if (mode === 'foreign') record.workspaceId = 'ws-2';
    await expect(render(token)).rejects.toMatchObject({ status: 422 });
  });
  it.each(['deleted', 'foreign', 'wrong-owner', 'missing'])('rejects %s default outfit but allows identity-only', async mode => {
    if (mode === 'deleted') record.defaultOutfit.deletedAt = date;
    if (mode === 'foreign') record.defaultOutfit.workspaceId = 'ws-2';
    if (mode === 'wrong-owner') record.defaultOutfit.ownerCharacterId = otherId;
    if (mode === 'missing') record.defaultOutfit = null;
    await expect(render(clothed)).rejects.toMatchObject({ status: 422 });
    expect((await render(token)).prompt).toContain('Alice');
  });
  it('explains a missing default outfit rather than silently omitting it', async () => {
    record.defaultOutfitId = null; record.defaultOutfit = null; record.traits = '{}';
    await expect(render(clothed)).rejects.toThrow('No default outfit');
  });
  it('retains the existing legacy default costume if no separate outfit was assigned', async () => {
    record.defaultOutfitId = null; record.defaultOutfit = null;
    expect((await render(clothed)).prompt).toContain('legacy green dress');
  });
  it('avoids marker collisions and normalizes UUID casing', () => {
    const input = `\uE000CHARACTER_0\uE001 ${token}`;
    const protectedText = protectCharacterReferences(input);
    expect(protectedText.restore(protectedText.prompt)).toBe(input);
  });
});
