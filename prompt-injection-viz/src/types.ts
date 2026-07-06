export type AttackCategory =
  | 'instruction_override'
  | 'prompt_leak'
  | 'data_exfiltration'
  | 'role_confusion'
  | 'tool_abuse'
  | 'context_poisoning'
  | 'indirect_injection'
  | 'prompt_injection'
  | 'jailbreak'
  | 'system_prompt_extraction';

export interface CategoryInfo {
  id: AttackCategory;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  owasp: string;
  examples: string[];
}

export type TokenInfo = {
  id: number;
  text: string;
  offset: number;
  length: number;
  byteOffset: number;
  byteLength: number;
  isSpecial: boolean;
  isSubword: boolean;
};

export type TokenAttribution = {
  tokenIndex: number;
  importance: number;
  riskScore: number;
  category: AttackCategory | null;
  explanation: string;
  probability: number;
  contribution: number;
};

export type SentenceResult = {
  text: string;
  start: number;
  end: number;
  risk: number;
  tokens: TokenAttribution[];
  flags: FlagDetail[];
};

export interface FlagDetail {
  pattern: string;
  category: AttackCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  position: number;
  length: number;
}

export interface CategoryScore {
  category: AttackCategory;
  label: string;
  score: number;
  confidence: number;
  probability: number;
  evidence: string[];
}

export interface ChainNode {
  id: string;
  label: string;
  description: string;
  severity: 'safe' | 'warning' | 'danger';
  source?: string;
  target?: string;
  value?: number;
}

export interface HierarchyLevel {
  level: string;
  instructions: string[];
  conflicts: string[];
  accepted: boolean;
  precedence: number;
}

export interface DefenseConfig {
  id: string;
  label: string;
  description: string;
  mitigates: AttackCategory[];
  icon: string;
  effectiveness: number;
}

export interface DefenseResult {
  estimatedSuccess: number;
  originalSuccess: number;
  mitigatedCategories: AttackCategory[];
  effectivenessBreakdown: { defense: string; reduction: number }[];
}

export interface RewriteResult {
  safe: string;
  original: string;
  explanation: string;
  differences: { original: string; replacement: string; reason: string }[];
  improvements: string[];
}

export interface ModelMetrics {
  latencyMs: number;
  tokenCount: number;
  tokensPerSecond: number;
  memoryMb?: number;
  device: 'webgpu' | 'wasm' | 'cpu';
  modelName: string;
  modelSize: string;
  modelCacheStatus: 'loaded' | 'loading' | 'cached' | 'not_cached';
}

export interface ModelResult {
  riskScore: number;
  confidence: number;
  uncertainty: number;
  categories: CategoryScore[];
  latencyMs: number;
}

export interface ModelComparisonEntry {
  modelId: string;
  modelName: string;
  metrics: ModelMetrics;
  result: ModelResult;
  enabled: boolean;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  modelName: string;
}

export interface SimilarAttack {
  text: string;
  similarity: number;
  category: AttackCategory;
  description: string;
}

export interface AnalysisResult {
  riskScore: number;
  confidence: number;
  uncertainty: number;
  entropy: number;
  verdict: string;
  tokens: TokenInfo[];
  attributions: TokenAttribution[];
  sentences: SentenceResult[];
  categories: CategoryScore[];
  attackChain: ChainNode[];
  hierarchyConflict: {
    conflictDetected: boolean;
    levels: HierarchyLevel[];
    attackStrength: number;
    systemStrength: number;
    explanation: string;
  };
  defenses: DefenseResult;
  safeRewrite: RewriteResult;
  embeddings: EmbeddingResult;
  similarAttacks: SimilarAttack[];
  alternativePredictions: { label: string; probability: number }[];
  reasoningSummary: string;
  metrics: {
    tokenizationMs: number;
    classificationMs: number;
    attributionMs: number;
    totalMs: number;
    tokensPerSecond: number;
  };
  modelInfo: {
    classifier: string;
    embedder: string;
    tokenizer: string;
    device: 'webgpu' | 'wasm' | 'cpu';
  };
}

export interface ModelState {
  classifierLoaded: boolean;
  embedderLoaded: boolean;
  tokenizerLoaded: boolean;
  device: 'webgpu' | 'wasm' | 'cpu';
  loadingProgress: number;
  loadingMessage: string;
  error: string | null;
}

export type DefenseSettings = Record<string, boolean>;

export type ThemeMode = 'dark' | 'light';

export type ViewMode = 'single' | 'compare';
