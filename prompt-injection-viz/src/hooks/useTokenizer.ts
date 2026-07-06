import { useState, useEffect, useCallback } from 'react';
import { tokenizerInterface } from '../ai/tokenizer';
import type { TokenInfo } from '../types';

export function useTokenizer() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tokenizerInterface.encode('test')
      .then(() => setIsReady(true))
      .catch(() => setIsReady(true));
  }, []);

  const tokenize = useCallback(async (text: string) => {
    try {
      const encoding = await tokenizerInterface.encode(text);
      const tokens = encoding.tokens.map((t, i) => ({
        id: encoding.ids[i],
        text: t,
        offset: encoding.offsets[i]?.start ?? 0,
        length: encoding.offsets[i]
          ? encoding.offsets[i].end - encoding.offsets[i].start
          : t.length,
        byteOffset: encoding.byteOffsets[i]?.start ?? 0,
        byteLength: encoding.byteOffsets[i]
          ? encoding.byteOffsets[i].end - encoding.byteOffsets[i].start
          : new TextEncoder().encode(t).length,
        isSpecial: encoding.specialTokensMask[i] ?? false,
        isSubword: encoding.subwordTokens[i] ?? false,
      }));
      setTokens(tokens);
      return tokens;
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  return { tokens, tokenize, isReady, error };
}
