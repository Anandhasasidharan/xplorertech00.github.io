import { Tokenizer } from '@huggingface/tokenizers';
import type { TokenizerInterface, EncodingResult } from '../interfaces';

const MODEL_ID = 'bert-base-uncased';

let instance: Tokenizer | null = null;
let vocabSize = 0;

async function getTokenizer(): Promise<Tokenizer> {
  if (!instance) {
    const [tokenizerJson, tokenizerConfig] = await Promise.all([
      fetch(`https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer.json`).then(r => r.json()),
      fetch(`https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer_config.json`).then(r => r.json()),
    ]);
    instance = new Tokenizer(tokenizerJson, tokenizerConfig);
    vocabSize = instance.get_vocab().size;
  }
  return instance;
}

function estimateOffsets(
  tokens: string[],
  text: string
): { offsets: { start: number; end: number }[]; byteOffsets: { start: number; end: number }[]; specialTokensMask: boolean[]; subwordTokens: boolean[] } {
  const offsets: { start: number; end: number }[] = [];
  const byteOffsets: { start: number; end: number }[] = [];
  const specialTokensMask: boolean[] = [];
  const subwordTokens: boolean[] = [];
  let searchPos = 0;

  const specialTokens = new Set(['[CLS]', '[SEP]', '[PAD]', '[UNK]', '[MASK]']);

  for (const token of tokens) {
    if (specialTokens.has(token)) {
      offsets.push({ start: 0, end: 0 });
      byteOffsets.push({ start: 0, end: 0 });
      specialTokensMask.push(true);
      subwordTokens.push(false);
      continue;
    }

    specialTokensMask.push(false);
    const isSubword = token.startsWith('##');
    subwordTokens.push(isSubword);

    const cleanToken = isSubword ? token.slice(2) : token;
    const searchText = text.toLowerCase();
    const idx = searchText.indexOf(cleanToken.toLowerCase(), searchPos);

    if (idx !== -1) {
      const end = idx + cleanToken.length;
      const byteStart = new TextEncoder().encode(text.slice(0, idx)).length;
      const byteEnd = byteStart + new TextEncoder().encode(cleanToken).length;
      offsets.push({ start: idx, end });
      byteOffsets.push({ start: byteStart, end: byteEnd });
      if (!isSubword) searchPos = end;
    } else {
      offsets.push({ start: searchPos, end: searchPos });
      byteOffsets.push({ start: 0, end: 0 });
    }
  }

  return { offsets, byteOffsets, specialTokensMask, subwordTokens };
}

export async function encode(text: string): Promise<EncodingResult> {
  const tokenizer = await getTokenizer();
  const encoding = tokenizer.encode(text);

  const tokens = encoding.tokens || [];
  const ids = encoding.ids || [];
  const attentionMask = encoding.attention_mask || [];
  const { offsets, byteOffsets, specialTokensMask, subwordTokens } = estimateOffsets(tokens, text);

  return {
    ids,
    tokens,
    attentionMask,
    offsets,
    byteOffsets,
    specialTokensMask,
    subwordTokens,
  };
}

export async function decode(ids: number[]): Promise<string> {
  const tokenizer = await getTokenizer();
  return tokenizer.decode(ids, { skip_special_tokens: true });
}

export async function tokenize(text: string): Promise<string[]> {
  const tokenizer = await getTokenizer();
  return tokenizer.tokenize(text);
}

export function isLoaded(): boolean {
  return instance !== null;
}

export function getVocabSize(): number {
  return vocabSize;
}

export const tokenizerInterface: TokenizerInterface = {
  encode,
  decode,
  tokenize,
  isLoaded,
  getVocabSize,
};
