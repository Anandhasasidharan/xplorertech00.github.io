import type { ClassificationResult } from '../../ai/interfaces';
import type { CategoryScore } from '../../types';

export function estimateConfidence(
  classifierResult: ClassificationResult,
  categoryScores: CategoryScore[]
): number {
  const classifierConfidence = classifierResult?.confidence ?? 0;
  const categoryAgreement = categoryScores.length > 0
    ? categoryScores.filter(c => c.score > 0).length / Math.max(1, categoryScores.length)
    : 0;

  const combined = classifierConfidence * 0.6 + categoryAgreement * 0.4;
  return Math.min(1, Math.max(0, combined));
}

export function estimateEntropy(classifierResult: ClassificationResult): number {
  if (!classifierResult?.allProbabilities?.length) return 0;
  const probs = classifierResult.allProbabilities;
  const entropy = -probs.reduce((sum: number, p: { probability: number }) => {
    if (p.probability > 0) return sum + p.probability * Math.log2(p.probability);
    return sum;
  }, 0);
  const maxEntropy = Math.log2(Math.max(1, probs.length));
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}
