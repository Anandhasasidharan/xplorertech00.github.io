import { createEngine, engine, InferenceEngine } from './inference';
import { tokenizerInterface } from './tokenizer';
import { classifierInterface } from './classifiers';
import { embedderInterface } from './embeddings';
import * as models from './models';

export const ai = {
  engine,
  createEngine,
  InferenceEngine,
  tokenizer: tokenizerInterface,
  classifier: classifierInterface,
  embedder: embedderInterface,
  models,
};
