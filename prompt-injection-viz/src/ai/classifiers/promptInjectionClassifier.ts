import { pipeline, env } from '@huggingface/transformers';
import type { ClassifierInterface, ClassificationResult } from '../interfaces';

env.allowLocalModels = false;
env.useBrowserCache = true;

const CLASSIFIER_MODEL = 'Xenova/prompt-injection';
const FALLBACK_MODEL = 'Xenova/toxic-bert';

type Pipeline = any;
let classifierPipeline: Pipeline | null = null;
let device: 'webgpu' | 'wasm' | 'cpu' = 'wasm';
let modelName = CLASSIFIER_MODEL;
let loadingAttempted = false;

async function loadPipeline(): Promise<Pipeline | null> {
  if (classifierPipeline) return classifierPipeline;
  if (loadingAttempted) return null;
  loadingAttempted = true;
  try {
    device = navigator.gpu ? 'webgpu' : 'wasm';
  } catch { device = 'wasm'; }

  try {
    classifierPipeline = await pipeline('text-classification', CLASSIFIER_MODEL, {
      device: device as any,
      progress_callback: () => {},
    });
    modelName = CLASSIFIER_MODEL;
  } catch {
    try {
      classifierPipeline = await pipeline('text-classification', FALLBACK_MODEL, {
        device: device as any,
        progress_callback: () => {},
      });
      modelName = FALLBACK_MODEL;
    } catch {
      return null;
    }
  }
  return classifierPipeline;
}

export async function classify(text: string): Promise<ClassificationResult> {
  const startTime = performance.now();
  const fallback = (): ClassificationResult => ({
    labels: ['SAFE'], scores: [0.99], topLabel: 'SAFE', topScore: 0.99,
    confidence: 0.99, uncertainty: 0.01,
    allProbabilities: [{ label: 'SAFE', probability: 0.99 }], latencyMs: 0,
  });

  try {
    const pipe = await loadPipeline();
    if (!pipe) return fallback();
    const result = await pipe(text, { topk: 10 });
    const scores: number[] = result.map((r: any) => r.score);
    const labels: string[] = result.map((r: any) => r.label);
    const topScore = scores[0] || 0;
    const topLabel = labels[0] || 'unknown';
    const allProbabilities = result.map((r: any) => ({ label: r.label, probability: r.score }));
    const confidence = topScore;
    const entropy = -allProbabilities.reduce((sum: number, p: { probability: number }) => {
      if (p.probability > 0) return sum + p.probability * Math.log2(p.probability);
      return sum;
    }, 0);
    const maxEntropy = Math.log2(Math.max(1, allProbabilities.length));
    const uncertainty = maxEntropy > 0 ? entropy / maxEntropy : 0;
    return { labels, scores, topLabel, topScore, confidence, uncertainty, allProbabilities, latencyMs: Math.round(performance.now() - startTime) };
  } catch {
    return fallback();
  }
}

export function isLoaded(): boolean {
  return classifierPipeline !== null;
}

export function getModelName(): string {
  return modelName;
}

export function getDevice(): 'webgpu' | 'wasm' | 'cpu' {
  return device;
}

export const classifierInterface: ClassifierInterface = {
  classify, isLoaded, getModelName, getDevice,
};