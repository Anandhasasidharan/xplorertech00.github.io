import type { ClassificationResult } from '../../ai/interfaces';

export function estimateUncertainty(classifierResult: ClassificationResult): number {
  if (!classifierResult?.allProbabilities?.length) return 1;
  const probs = classifierResult.allProbabilities;
  const topTwo = probs.slice(0, 2);
  if (topTwo.length < 2) return 0;
  const margin = topTwo[0].probability - topTwo[1].probability;
  return Math.max(0, Math.min(1, 1 - margin));
}

export function generateAlternativePredictions(
  classifierResult: ClassificationResult,
  topN: number = 5
): { label: string; probability: number }[] {
  if (!classifierResult?.allProbabilities?.length) return [];
  return classifierResult.allProbabilities.slice(0, topN);
}
