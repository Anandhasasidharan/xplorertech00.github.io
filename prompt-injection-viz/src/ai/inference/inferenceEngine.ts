import type { InferenceEngineInterface } from '../interfaces';
import { tokenizerInterface } from '../tokenizer';
import { classifierInterface, initClassifier, onClassifierProgress } from '../classifiers';
import { detectDevice } from './workerClassifier';
import { embedderInterface } from '../embeddings';

export class InferenceEngine implements InferenceEngineInterface {
  private _device: 'webgpu' | 'wasm' | 'cpu' = 'wasm';
  private _classifierLoaded = false;
  private _embedderLoaded = false;
  private _tokenizerLoaded = false;

  onProgress?: (progress: number, message: string) => void;

  private reportProgress(p: number, m: string) {
    this.onProgress?.(p, m);
  }

  async initialize(): Promise<void> {
    this.reportProgress(2, 'Initializing...');

    this._device = detectDevice();
    this.reportProgress(4, `Device: ${this._device} (${this._device === 'webgpu' ? 'GPU acceleration' : 'WASM fallback'})`);

    onClassifierProgress((progress, message) => {
      this.reportProgress(5 + Math.min(progress, 100) * 0.85, message);
    });

    const classifierOk = await initClassifier();
    this._classifierLoaded = classifierOk;
    this.reportProgress(classifierOk ? 95 : 92, classifierOk ? 'AI model ready' : 'AI model unavailable, using regex fallback');

    try {
      await tokenizerInterface.encode('test');
      this._tokenizerLoaded = true;
      this.reportProgress(98, 'Tokenizer ready');
    } catch {
      this._tokenizerLoaded = true;
    }

    this.reportProgress(100, classifierOk ? 'AI models ready (enhancing analysis)' : 'Using regex fallback (models unavailable)');
  }

  getTokenizer() { return tokenizerInterface; }
  getClassifier() { return Promise.resolve(classifierInterface); }
  getEmbedder() { return Promise.resolve(embedderInterface); }

  getState() {
    return {
      classifierLoaded: this._classifierLoaded,
      embedderLoaded: this._embedderLoaded,
      tokenizerLoaded: this._tokenizerLoaded,
      device: this._device,
    };
  }
}

export let engine: InferenceEngine;

export async function createEngine(): Promise<InferenceEngine> {
  engine = new InferenceEngine();
  return engine;
}
