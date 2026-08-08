import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

export interface ModelRecord {
  id: string;
  name: string;
  type: 'classifier' | 'embedding' | 'generation';
  size: string;
  import: () => Promise<any>;
  loaded: boolean;
}

const registry: Map<string, ModelRecord> = new Map();

export function registerModel(model: ModelRecord): void {
  registry.set(model.id, model);
}

export function getModel(id: string): ModelRecord | undefined {
  return registry.get(id);
}

export function getModelsByType(type: ModelRecord['type']): ModelRecord[] {
  return Array.from(registry.values()).filter(m => m.type === type);
}

export function getAllModels(): ModelRecord[] {
  return Array.from(registry.values());
}

registerModel({
  id: 'Xenova/toxic-bert',
  name: 'Toxic BERT (injection proxy)',
  type: 'classifier',
  size: '110 MB',
  loaded: false,
  import: () => pipeline('text-classification', 'Xenova/toxic-bert', { device: 'wasm', dtype: 'int8' }),
});

registerModel({
  id: 'Xenova/all-MiniLM-L6-v2',
  name: 'MiniLM Embeddings',
  type: 'embedding',
  size: '23 MB',
  loaded: false,
  import: () => pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device: 'wasm' }),
});

export async function loadModel(id: string): Promise<any> {
  const model = registry.get(id);
  if (!model) throw new Error(`Model ${id} not found`);
  if (model.loaded) return model;
  try {
    const pipe = await model.import();
    model.loaded = true;
    return pipe;
  } catch (e) {
    throw new Error(`Failed to load model ${id}: ${e}`);
  }
}
