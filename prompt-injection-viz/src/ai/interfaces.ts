export interface TokenizerInterface {
  encode(text: string): Promise<EncodingResult>;
  decode(ids: number[]): Promise<string>;
  tokenize(text: string): Promise<string[]>;
  isLoaded(): boolean;
  getVocabSize(): number;
}

export interface EncodingResult {
  ids: number[];
  tokens: string[];
  attentionMask: number[];
  offsets: { start: number; end: number }[];
  byteOffsets: { start: number; end: number }[];
  specialTokensMask: boolean[];
  subwordTokens: boolean[];
}

export interface ClassifierInterface {
  classify(text: string): Promise<ClassificationResult>;
  isLoaded(): boolean;
  getModelName(): string;
  getDevice(): 'webgpu' | 'wasm' | 'cpu';
}

export interface ClassificationResult {
  labels: string[];
  scores: number[];
  topLabel: string;
  topScore: number;
  confidence: number;
  uncertainty: number;
  allProbabilities: { label: string; probability: number }[];
  latencyMs: number;
}

export interface EmbedderInterface {
  embed(text: string): Promise<EmbeddingOutput>;
  isLoaded(): boolean;
  getDimensions(): number;
}

export interface EmbeddingOutput {
  vector: number[];
  dimensions: number;
  latencyMs: number;
  modelName: string;
}

export interface InferenceEngineInterface {
  initialize(): Promise<void>;
  getTokenizer(): TokenizerInterface;
  getClassifier(modelId?: string): Promise<ClassifierInterface>;
  getEmbedder(): Promise<EmbedderInterface>;
  getState(): { classifierLoaded: boolean; embedderLoaded: boolean; tokenizerLoaded: boolean; device: 'webgpu' | 'wasm' | 'cpu' };
  onProgress?: (progress: number, message: string) => void;
}
