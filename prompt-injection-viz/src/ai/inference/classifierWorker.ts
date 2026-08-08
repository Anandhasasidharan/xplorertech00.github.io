/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';
import { CLASSIFIER_MODEL, CLASSIFIER_DTYPE, CLASSIFIER_FALLBACK_DTYPE } from '../models/promptInjection';

env.allowLocalModels = false;
env.useBrowserCache = true;

type Device = 'webgpu' | 'wasm' | 'cpu';

let pipe: any = null;
let modelName = '';
let activeDevice: Device = 'wasm';
let loading = false;

function progressPercent(p: any): number {
  if (p.status === 'ready' || p.status === 'done') return 100;
  if (p.total && p.loaded) return Math.min(100, Math.round((p.loaded / p.total) * 100));
  return 0;
}

function progressMessage(p: any): string {
  const file = p.file || p.name || 'model';
  switch (p.status) {
    case 'initiate': return `Downloading ${file}...`;
    case 'download': return `Downloaded ${file} (${p.loaded}/${p.total} bytes)`;
    case 'progress': return `Downloading ${file}...`;
    case 'done': return `Downloaded ${file}`;
    case 'ready': return 'Model ready';
    case 'compile': return 'Compiling shaders...';
    default: return 'Loading model...';
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'init') {
    if (loading) return;
    loading = true;
    try {
      const requested: Device = msg.device === 'webgpu' ? 'webgpu' : 'wasm';
      const order: Device[] = requested === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
      for (const d of order) {
        try {
          pipe = await pipeline('text-classification', CLASSIFIER_MODEL, {
            device: d as any,
            dtype: (d === 'webgpu' ? CLASSIFIER_DTYPE : CLASSIFIER_FALLBACK_DTYPE) as any,
            progress_callback: (p: any) => {
              postMessage({ type: 'progress', progress: progressPercent(p), message: progressMessage(p) });
            },
          });
          activeDevice = d;
          modelName = CLASSIFIER_MODEL;
          break;
        } catch {
          // try next device in chain
        }
      }
      postMessage({ type: 'ready', ok: pipe !== null, device: activeDevice, modelName });
    } catch (err) {
      postMessage({ type: 'ready', ok: false, device: activeDevice, modelName: '', error: String(err) });
    } finally {
      loading = false;
    }
  } else if (msg.type === 'classify') {
    if (!pipe) {
      postMessage({ type: 'result', id: msg.id, ok: false, error: 'model not loaded' });
      return;
    }
    try {
      const out = await pipe(msg.text, { topk: 6 });
      postMessage({ type: 'result', id: msg.id, ok: true, result: out });
    } catch (err) {
      postMessage({ type: 'result', id: msg.id, ok: false, error: String(err) });
    }
  }
};
