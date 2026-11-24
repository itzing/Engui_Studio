export type CharacterReference = { token: string; characterId: string; includeOutfit: boolean };

export function characterReferenceToken(id: string, includeOutfit = false): string {
  return `{character:${id}${includeOutfit ? ':withOutfit' : ''}}`;
}

// Mask references before seeded variants so braces inside a choice are not mistaken
// for the end of the choice. Character descriptions themselves are literal text.
export function protectCharacterReferences(input: string) {
  let prefix = '\uE000CHARACTER_';
  while (input.includes(prefix)) prefix += '_';
  const references: CharacterReference[] = [];
  const pattern = /\{character:/g;
  let output = '', cursor = 0, match: RegExpExecArray | null;
  while ((match = pattern.exec(input))) {
    const end = input.indexOf('}', match.index);
    const token = end < 0 ? input.slice(match.index) : input.slice(match.index, end + 1);
    const parsed = token.match(/^\{character:([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})(:withOutfit)?\}$/);
    if (!parsed) throw new Error('Invalid character tag. Use {character:ID} or {character:ID:withOutfit}.');
    output += input.slice(cursor, match.index) + `${prefix}${references.length}\uE001`;
    references.push({ token, characterId: parsed[1].toLowerCase(), includeOutfit: Boolean(parsed[2]) });
    cursor = end + 1;
    pattern.lastIndex = cursor;
  }
  output += input.slice(cursor);
  return {
    prompt: output,
    references,
    restore: (text: string) => references.reduce((result, ref, index) => result.split(`${prefix}${index}\uE001`).join(ref.token), text),
  };
}
