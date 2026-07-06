import { pipeline, env } from '@huggingface/transformers';
import type { EmbedderInterface, EmbeddingOutput } from '../interfaces';

env.allowLocalModels = false;
env.useBrowserCache = true;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractionPipeline = any;
let embedderPipeline: FeatureExtractionPipeline | null = null;
const dimensions = 384;
let modelName = EMBEDDING_MODEL;

async function loadEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedderPipeline) return embedderPipeline;

  embedderPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, {
    device: 'wasm',
    progress_callback: () => {},
  });
  return embedderPipeline;
}

export async function embed(text: string): Promise<EmbeddingOutput> {
  const startTime = performance.now();
  const pipe = await loadEmbedder();
  const result = await pipe(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(result.data as Float32Array);
  const latencyMs = Math.round(performance.now() - startTime);
  return { vector, dimensions, latencyMs, modelName };
}

export function isLoaded(): boolean {
  return embedderPipeline !== null;
}

export function getDimensions(): number {
  return dimensions;
}

export const embedderInterface: EmbedderInterface = {
  embed, isLoaded, getDimensions,
};
