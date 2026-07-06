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
let externalOnProgress: ((p: number, m: string) => void) | undefined;

export function setOnProgress(cb?: (p: number, m: string) => void) {
  externalOnProgress = cb;
}

async function loadPipeline(): Promise<Pipeline> {
  if (classifierPipeline) return classifierPipeline;
  try {
    device = navigator.gpu ? 'webgpu' : 'wasm';
  } catch { device = 'wasm'; }

  externalOnProgress?.(10, 'Loading classification model...');

  try {
    classifierPipeline = await pipeline('text-classification', CLASSIFIER_MODEL, {
      device: device as any,
      progress_callback: (p: any) => {
        if (p.status === 'progress') {
          externalOnProgress?.(10 + Math.round(p.progress * 40), `Loading classifier: ${Math.round(p.progress * 100)}%`);
        }
      },
    });
    modelName = CLASSIFIER_MODEL;
  } catch {
    externalOnProgress?.(30, 'Primary model failed, loading fallback...');
    classifierPipeline = await pipeline('text-classification', FALLBACK_MODEL, {
      device: device as any,
      progress_callback: (p: any) => {
        if (p.status === 'progress') {
          externalOnProgress?.(30 + Math.round(p.progress * 40), `Loading fallback: ${Math.round(p.progress * 100)}%`);
        }
      },
    });
    modelName = FALLBACK_MODEL;
  }

  externalOnProgress?.(70, 'Classifier ready');
  return classifierPipeline;
}

export async function classify(text: string): Promise<ClassificationResult> {
  const startTime = performance.now();
  const pipe = await loadPipeline();
  const result = await pipe(text, { topk: 10 });

  const scores: number[] = result.map((r: any) => r.score);
  const labels: string[] = result.map((r: any) => r.label);
  const topScore = scores[0] || 0;
  const topLabel = labels[0] || 'unknown';

  const allProbabilities = result.map((r: any) => ({
    label: r.label,
    probability: r.score,
  }));

  const confidence = topScore;
  const entropy = -allProbabilities.reduce((sum: number, p: { probability: number }) => {
    if (p.probability > 0) return sum + p.probability * Math.log2(p.probability);
    return sum;
  }, 0);
  const maxEntropy = Math.log2(Math.max(1, allProbabilities.length));
  const uncertainty = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const latencyMs = Math.round(performance.now() - startTime);

  return {
    labels, scores, topLabel, topScore,
    confidence, uncertainty,
    allProbabilities, latencyMs,
  };
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
