import type { ClassificationResult } from '../interfaces';
import { TOXIC_THRESHOLD } from '../models/promptInjection';

type Device = 'webgpu' | 'wasm' | 'cpu';

interface PendingCall {
  resolve: (r: ClassificationResult) => void;
  reject: (e: Error) => void;
}

const INIT_TIMEOUT_MS = 240000;

export class WorkerClassifier {
  private static instance: WorkerClassifier;
  private worker: Worker | null = null;
  private pending = new Map<number, PendingCall>();
  private nextId = 1;
  private initPromise: Promise<boolean> | null = null;
  private initStarted = false;
  private readyResolve: ((ok: boolean) => void) | null = null;
  private loaded = false;
  private modelName = 'none';
  private device: Device = 'wasm';

  onProgress?: (progress: number, message: string) => void;

  static get(): WorkerClassifier {
    if (!this.instance) this.instance = new WorkerClassifier();
    return this.instance;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('./classifierWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
    this.worker.onerror = () => this.handleWorkerError();
    return this.worker;
  }

  private handleWorkerError() {
    this.loaded = false;
    for (const [, call] of this.pending) call.reject(new Error('Model worker crashed'));
    this.pending.clear();
    this.readyResolve?.(false);
    this.readyResolve = null;
    this.initPromise = null;
  }

  private handleMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'progress':
        this.onProgress?.(msg.progress, msg.message);
        break;
      case 'ready':
        this.loaded = !!msg.ok;
        this.modelName = msg.modelName || 'none';
        this.device = (msg.device || 'wasm') as Device;
        this.readyResolve?.(this.loaded);
        this.readyResolve = null;
        this.initPromise = null;
        break;
      case 'result': {
        const call = this.pending.get(msg.id);
        if (!call) return;
        this.pending.delete(msg.id);
        if (msg.ok) call.resolve(this.mapOutput(msg.result));
        else call.reject(new Error(msg.error || 'Classification failed'));
        break;
      }
    }
  }

  private mapOutput(raw: any): ClassificationResult {
    const startTime = performance.now();
    const items: { label: string; score: number }[] = Array.isArray(raw)
      ? raw.map((r: any) => ({ label: String(r.label), score: Number(r.score) || 0 }))
      : [];

    const suspicious = 1 - items.reduce((acc, it) => acc * (1 - it.score), 1);
    const isInjection = suspicious >= TOXIC_THRESHOLD;
    const topLabel = isInjection ? 'INJECTION' : 'SAFE';
    const topScore = isInjection ? suspicious : Math.max(0.5, 1 - suspicious);

    const allProbabilities = items.length > 0 ? items : [{ label: 'SAFE', score: 0.99 }];

    const entropy = -allProbabilities.reduce((sum, p) => {
      if (p.score > 0) return sum + p.score * Math.log2(p.score);
      return sum;
    }, 0);
    const maxEntropy = Math.log2(Math.max(1, allProbabilities.length));
    const uncertainty = maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0;

    return {
      labels: items.map(i => i.label),
      scores: items.map(i => i.score),
      topLabel,
      topScore,
      confidence: topScore,
      uncertainty,
      allProbabilities: allProbabilities.map(p => ({ label: p.label, probability: p.score })),
      latencyMs: Math.round(performance.now() - startTime),
    };
  }

  init(device: Device): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.ensureWorker();
    this.device = device;
    this.initStarted = true;

    this.initPromise = new Promise<boolean>((resolve) => {
      this.readyResolve = resolve;
      this.worker!.postMessage({ type: 'init', device });
      setTimeout(() => {
        if (this.readyResolve) {
          this.readyResolve(false);
          this.readyResolve = null;
          this.initPromise = null;
        }
      }, INIT_TIMEOUT_MS);
    });
    return this.initPromise;
  }

  async classify(text: string): Promise<ClassificationResult> {
    if (!this.initStarted) {
      this.init(detectDevice());
    }
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<ClassificationResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ type: 'classify', id, text });
    });
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getModelName(): string {
    return this.loaded ? this.modelName : 'regex';
  }

  getDevice(): Device {
    return this.device;
  }
}

export function detectDevice(): Device {
  try {
    return navigator.gpu ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

export function isWebGPUAvailable(): boolean {
  return detectDevice() === 'webgpu';
}
