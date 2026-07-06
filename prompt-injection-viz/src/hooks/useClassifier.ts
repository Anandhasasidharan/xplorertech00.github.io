import { useState, useCallback } from 'react';
import { classifierInterface } from '../ai/classifiers';
import type { ClassificationResult } from '../ai/interfaces';

export function useClassifier() {
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classify = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await classifierInterface.classify(text);
      setResult(res);
      return res;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { result, classify, isLoading, error };
}
