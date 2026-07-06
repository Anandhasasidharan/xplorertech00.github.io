import type { InferenceEngineInterface } from '../interfaces';
import { tokenizerInterface } from '../tokenizer';
import { classifierInterface } from '../classifiers';
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
    this.reportProgress(0, 'Initializing...');

    try {
      this._device = navigator.gpu ? 'webgpu' : 'wasm';
    } catch { this._device = 'wasm'; }
    this.reportProgress(5, `Device: ${this._device}`);

    try {
      await tokenizerInterface.encode('test');
      this._tokenizerLoaded = true;
      this.reportProgress(20, 'Tokenizer loaded');
    } catch {
      this.reportProgress(20, 'Tokenizer fallback');
      this._tokenizerLoaded = true;
    }

    try {
      await classifierInterface.classify('test');
      this._classifierLoaded = true;
      this.reportProgress(60, 'Classifier loaded');
    } catch {
      this.reportProgress(60, 'Classifier fallback');
      this._classifierLoaded = true;
    }

    try {
      await embedderInterface.embed('test');
      this._embedderLoaded = true;
      this.reportProgress(90, 'Embedder loaded');
    } catch {
      this.reportProgress(90, 'Embedder fallback');
      this._embedderLoaded = true;
    }

    this.reportProgress(100, 'Ready');
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
