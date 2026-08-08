import type { ClassifierInterface, ClassificationResult } from '../interfaces';
import { WorkerClassifier, detectDevice } from '../inference/workerClassifier';

const client = WorkerClassifier.get();

export async function classify(text: string): Promise<ClassificationResult> {
  return client.classify(text);
}

export function isLoaded(): boolean {
  return client.isLoaded();
}

export function getModelName(): string {
  return client.getModelName();
}

export function getDevice(): 'webgpu' | 'wasm' | 'cpu' {
  return detectDevice();
}

export function initClassifier(): Promise<boolean> {
  return client.init(detectDevice());
}

export function onClassifierProgress(cb: (progress: number, message: string) => void): void {
  client.onProgress = cb;
}

export const classifierInterface: ClassifierInterface = {
  classify, isLoaded, getModelName, getDevice,
};
