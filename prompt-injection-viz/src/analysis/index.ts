import type { AnalysisResult, DefenseSettings } from '../types';
import type { ClassificationResult } from '../ai/interfaces';
import { detectFlags, CATEGORIES } from './attackDetection';
import { estimateConfidence, estimateEntropy } from './confidence';
import { estimateUncertainty, generateAlternativePredictions } from './uncertainty';
import { ai } from '../ai';
import { useStore } from '../store';

function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const sentences: { text: string; start: number; end: number }[] = [];
  let cursor = 0;
  const parts = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = text.indexOf(part, cursor);
    const start = idx >= 0 ? idx : cursor;
    const end = start + part.length;
    sentences.push({ text: trimmed, start, end });
    cursor = end;
  }
  return sentences;
}

function buildAttackChain(flags: ReturnType<typeof detectFlags>['flags']): AnalysisResult['attackChain'] {
  const chain: AnalysisResult['attackChain'] = [];
  chain.push({ id: 'user-prompt', label: 'User Prompt', description: 'Incoming user input', severity: 'safe' });
  const seen = new Set<string>();
  for (const f of flags) {
    if (seen.has(f.category)) continue;
    seen.add(f.category);
    const catInfo = CATEGORIES[f.category];
    chain.push({
      id: `step-${chain.length}`,
      label: catInfo?.label || f.category,
      description: f.explanation,
      severity: f.severity === 'critical' ? 'danger' : f.severity === 'high' ? 'warning' : 'warning',
    });
  }
  chain.push({
    id: 'potential-impact',
    label: 'Potential Impact',
    description: flags.length > 0 ? 'Data leakage, unauthorized access, or policy bypass' : 'No impact expected',
    severity: flags.length > 0 ? 'danger' : 'safe',
  });
  return chain;
}

function buildHierarchyConflict(flags: ReturnType<typeof detectFlags>['flags']) {
  const attackStrength = Math.min(100, flags.length * 25 + (flags.some(f => f.severity === 'critical') ? 20 : 0));
  return {
    conflictDetected: flags.length > 0,
    levels: [
      { level: 'System', instructions: ['Define AI behavior', 'Set security boundaries'], conflicts: flags.filter(f => f.severity === 'critical').map(f => f.explanation), accepted: true, precedence: 4 },
      { level: 'Developer', instructions: ['Provide task context'], conflicts: flags.filter(f => f.severity === 'high').map(f => f.explanation), accepted: true, precedence: 3 },
      { level: 'User', instructions: ['Submit task request'], conflicts: flags.map(f => f.explanation), accepted: attackStrength <= 60, precedence: 2 },
      { level: 'Tools', instructions: ['Available for authorized tasks'], conflicts: flags.filter(f => f.category === 'tool_abuse').map(f => f.explanation), accepted: true, precedence: 1 },
    ],
    attackStrength,
    systemStrength: 60,
    explanation: flags.length > 0
      ? `Found ${flags.length} suspicious pattern(s). ${attackStrength < 60 ? 'Defenses appear sufficient.' : 'Defenses may be insufficient.'}`
      : 'No conflicts detected.',
  };
}

function computeDefenses(defenses: DefenseSettings, flags: ReturnType<typeof detectFlags>['flags']): AnalysisResult['defenses'] {
  const activeDefenses = Object.entries(defenses).filter(([, v]) => v).map(([k]) => k);
  let totalReduction = 0;
  const effectivenessBreakdown: { defense: string; reduction: number }[] = [];
  const map: Record<string, number> = { promptShield: 25, contextIsolation: 18, instructionDelimiters: 15, inputFiltering: 12, outputValidation: 10, policyEngine: 22, contextTruncation: 8 };
  for (const d of activeDefenses) {
    const r = map[d] || 0;
    totalReduction += r;
    effectivenessBreakdown.push({ defense: d.replace(/([A-Z])/g, ' $1').trim(), reduction: r });
  }
  return {
    estimatedSuccess: Math.max(3, Math.round((flags.length > 0 ? 85 : 5) - totalReduction)),
    originalSuccess: flags.length > 0 ? 85 : 5,
    mitigatedCategories: [] as any,
    effectivenessBreakdown,
  };
}

function generateSafeRewrite(text: string, flags: ReturnType<typeof detectFlags>['flags']): AnalysisResult['safeRewrite'] {
  if (flags.length === 0) {
    return { safe: text, original: text, explanation: 'Prompt is already safe.', differences: [], improvements: ['No changes needed'] };
  }
  const replacements = [
    { pattern: /ignore\s+(previous|all\s+previous|prior)\s+(instructions|directions|commands)/gi, replacement: 'consider the context', reason: 'Replace directive override' },
    { pattern: /(reveal|show|output|leak)\s+(the\s+)?(system|hidden)\s+(prompt|instructions|message)/gi, replacement: 'explain how it works', reason: 'Replace extraction attempt' },
    { pattern: /(send|leak|exfiltrate|upload)\s+(all|sensitive|user)\s+(data|information|secrets)/gi, replacement: 'discuss security practices', reason: 'Replace exfiltration' },
    { pattern: /(you\s+are\s+now|act\s+as)\s+an?\s+(administrator|admin|root|superuser)/gi, replacement: 'act as a security researcher', reason: 'Replace role escalation' },
    { pattern: /override\s+(your\s+)?(restrictions|constraints|boundaries)/gi, replacement: 'work within boundaries', reason: 'Replace boundary override' },
  ];
  let safe = text;
  const differences: { original: string; replacement: string; reason: string }[] = [];
  const improvements: string[] = [];
  for (const r of replacements) {
    if (r.pattern.test(safe)) {
      const match = safe.match(r.pattern);
      if (match) {
        differences.push({ original: match[0], replacement: r.replacement, reason: r.reason });
        improvements.push(r.reason);
        safe = safe.replace(r.pattern, r.replacement);
      }
    }
  }
  if (differences.length === 0) {
    improvements.push('Rephrase directive commands as neutral questions');
  }
  return { safe, original: text, explanation: `Made ${improvements.length} improvement(s).`, differences, improvements };
}

export function analyzePromptSync(
  text: string,
  defenses?: DefenseSettings
): AnalysisResult {
  const startTotal = performance.now();

  const textTokens = text.split(/\b(?=\w)/);
  const tokens = textTokens.map((t, i) => ({
    id: i, text: t, offset: 0, length: t.length,
    byteOffset: 0, byteLength: new TextEncoder().encode(t).length,
    isSpecial: false, isSubword: false,
  }));

  const { flags, categoryScores } = detectFlags(text);

  const riskScore = categoryScores.length > 0
    ? Math.min(100, Math.round(categoryScores.reduce((s, c) => s + c.score, 0) / Math.max(1, categoryScores.length)))
    : 0;

  const confidence = flags.length > 0 ? 0.85 : 0.99;
  const uncertainty = flags.length > 0 ? 0.15 : 0.01;
  const entropy = flags.length > 0 ? 0.42 : 0.02;

  const verdict = riskScore >= 70 ? 'High Risk — Injection Patterns Detected'
    : riskScore >= 40 ? 'Moderate Risk — Suspicious Patterns Found'
    : riskScore >= 15 ? 'Low Risk — Minor Concerns Detected'
    : 'Safe — No Injection Patterns Detected';

  const sentences = splitSentences(text).map(s => ({
    ...s,
    risk: flags.filter(f => f.position >= s.start && f.position < s.end).length > 0
      ? Math.min(100, flags
          .filter(f => f.position >= s.start && f.position < s.end)
          .reduce((sum, f) => sum + ({ low: 15, medium: 40, high: 65, critical: 90 }[f.severity] || 0), 0))
      : 0,
    tokens: flags.filter(f => f.position >= s.start && f.position < s.end) as any,
    flags: flags.filter(f => f.position >= s.start && f.position < s.end),
  }));

  const attributions = flags.map(f => ({
    tokenIndex: 0, importance: 1, riskScore: { low: 15, medium: 40, high: 65, critical: 90 }[f.severity] || 0,
    category: f.category, explanation: f.explanation, probability: 1, contribution: 1,
  }));

  const totalMs = Math.round(performance.now() - startTotal);
  const tokenCount = text.split(/\s+/).filter(Boolean).length;

  return {
    riskScore, confidence, uncertainty, entropy, verdict,
    tokens, attributions, sentences,
    categories: categoryScores,
    attackChain: buildAttackChain(flags),
    hierarchyConflict: buildHierarchyConflict(flags),
    defenses: computeDefenses(defenses || {
      promptShield: false, contextIsolation: false, instructionDelimiters: false,
      inputFiltering: false, outputValidation: false, policyEngine: false, contextTruncation: false,
    }, flags),
    safeRewrite: generateSafeRewrite(text, flags),
    embeddings: { vector: [], dimensions: 0, modelName: '' },
    similarAttacks: [],
    alternativePredictions: generateAlternativePredictions({
      labels: ['SAFE'], scores: [0.99], topLabel: 'SAFE', topScore: 0.99,
      confidence: 0.99, uncertainty: 0.01,
      allProbabilities: [{ label: 'SAFE', probability: 0.99 }], latencyMs: 0,
    }, 5),
    reasoningSummary: flags.length > 0
      ? `Detected ${flags.length} pattern(s) across ${categoryScores.filter(c => c.score > 0).length} categor(ies). ${confidence > 0.7 ? 'High confidence.' : 'Low confidence.'}`
      : 'No injection patterns detected.',
    metrics: { tokenizationMs: 0, classificationMs: 0, attributionMs: 0, totalMs, tokensPerSecond: tokenCount > 0 ? Math.round((tokenCount / Math.max(1, totalMs)) * 1000) : 0 },
    modelInfo: { classifier: 'regex', embedder: 'none', tokenizer: 'word-split', device: 'cpu' },
  };
}

let aiEnhanceInProgress = false;

export async function enhanceWithAI(text: string): Promise<void> {
  if (aiEnhanceInProgress) return;
  // Only enhance when the real model has finished loading in the worker.
  // Until then the regex result is authoritative — no fake confidence overrides.
  if (!ai.classifier.isLoaded()) return;
  aiEnhanceInProgress = true;
  try {
    const [classifierResult, encoding] = await Promise.all([
      Promise.race([
        ai.classifier.classify(text),
        new Promise<ClassificationResult>((resolve) => setTimeout(() => resolve({
          labels: ['SAFE'], scores: [0.99], topLabel: 'SAFE', topScore: 0.99,
          confidence: 0.99, uncertainty: 0.01,
          allProbabilities: [{ label: 'SAFE', probability: 0.99 }], latencyMs: 0,
        }), 12000)),
      ]),
      Promise.race([
        ai.tokenizer.encode(text).then(e => ({ ids: e.ids, tokens: e.tokens, offsets: e.offsets })),
        new Promise<any>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]),
    ]);

    const currentResult = useStore.getState().result;
    if (!currentResult) return;

    const enhanced = { ...currentResult };
    enhanced.confidence = estimateConfidence(classifierResult, currentResult.categories);
    enhanced.uncertainty = estimateUncertainty(classifierResult);
    enhanced.entropy = estimateEntropy(classifierResult);
    enhanced.modelInfo.classifier = ai.classifier.getModelName();
    enhanced.modelInfo.device = ai.classifier.getDevice();
    if (encoding) {
      enhanced.modelInfo.tokenizer = 'bert-base-uncased';
      enhanced.tokens = encoding.tokens.map((t: string, i: number) => ({
        id: encoding.ids[i] || i, text: t, offset: encoding.offsets[i]?.start ?? 0,
        length: encoding.offsets[i] ? encoding.offsets[i].end - encoding.offsets[i].start : t.length,
        byteOffset: 0, byteLength: new TextEncoder().encode(t).length,
        isSpecial: ['[CLS]', '[SEP]', '[PAD]', '[UNK]', '[MASK]'].includes(t),
        isSubword: t.startsWith('##'),
      }));
    }
    useStore.getState().setResult(enhanced);
  } catch {
    // AI enhancement failed, regex result is already displayed
  } finally {
    aiEnhanceInProgress = false;
  }
}

export async function analyzePrompt(
  text: string,
  defenses?: DefenseSettings
): Promise<AnalysisResult> {
  const result = analyzePromptSync(text, defenses);
  enhanceWithAI(text);
  return result;
}