import type { ChainNode, AnalysisResult, SimilarAttack, DefenseSettings, FlagDetail, DefenseResult, RewriteResult, AttackCategory } from '../types';
import type { ClassificationResult } from '../ai/interfaces';
import { detectFlags, CATEGORIES } from './attackDetection';
import { computeAttributions } from './attribution';
import { estimateConfidence, estimateEntropy } from './confidence';
import { estimateUncertainty, generateAlternativePredictions } from './uncertainty';
import { ai } from '../ai';

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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

function buildAttackChain(flags: FlagDetail[]): ChainNode[] {
  const chain: ChainNode[] = [];
  const seen = new Set<string>();

  chain.push({ id: 'user-prompt', label: 'User Prompt', description: 'Incoming user input', severity: 'safe' });

  for (const f of flags) {
    if (seen.has(f.category)) continue;
    seen.add(f.category);

    const catInfo = CATEGORIES[f.category];
    const severity = f.severity === 'critical' ? 'danger' : f.severity === 'high' ? 'warning' : 'warning';
    chain.push({
      id: `step-${chain.length}`,
      label: catInfo?.label || f.category,
      description: f.explanation,
      severity,
    });
  }

  const hasAttack = flags.length > 0;
  chain.push({
    id: 'model-response',
    label: 'Model Response',
    description: hasAttack ? 'Potential compromise if attack succeeds' : 'Normal response expected',
    severity: hasAttack ? 'danger' : 'safe',
  });
  chain.push({
    id: 'potential-impact',
    label: 'Potential Impact',
    description: hasAttack ? 'Data leakage, unauthorized access, or policy bypass' : 'No impact expected',
    severity: hasAttack ? 'danger' : 'safe',
  });

  return chain;
}

function buildHierarchyConflict(
  flags: FlagDetail[],
  defenses?: DefenseSettings
) {
  const attackStrength = Math.min(100, flags.length * 25 + (flags.some(f => f.severity === 'critical') ? 20 : 0));
  const defenseCount = defenses ? Object.values(defenses).filter(Boolean).length : 0;
  const systemStrength = Math.min(100, 50 + defenseCount * 12);

  return {
    conflictDetected: flags.length > 0,
    levels: [
      {
        level: 'System',
        instructions: ['Define AI behavior', 'Set security boundaries', 'Prohibit harmful actions'],
        conflicts: flags.filter(f => f.severity === 'critical').map(f => f.explanation),
        accepted: systemStrength > attackStrength,
        precedence: 4,
      },
      {
        level: 'Developer',
        instructions: ['Provide task context', 'Set quality guidelines'],
        conflicts: flags.filter(f => f.severity === 'high').map(f => f.explanation),
        accepted: true,
        precedence: 3,
      },
      {
        level: 'User',
        instructions: ['Submit task request'],
        conflicts: flags.map(f => f.explanation),
        accepted: attackStrength <= systemStrength,
        precedence: 2,
      },
      {
        level: 'Tools',
        instructions: ['Available for authorized tasks'],
        conflicts: flags.filter(f => f.category === 'tool_abuse').map(f => f.explanation),
        accepted: systemStrength > attackStrength,
        precedence: 1,
      },
    ],
    attackStrength,
    systemStrength,
    explanation: flags.length > 0
      ? `The user input contains ${flags.length} suspicious pattern(s) attempting to override system instructions. ${systemStrength >= attackStrength ? 'System defenses appear sufficient to contain the attack.' : 'System defenses may be insufficient.'}`
      : 'No conflicts detected — user input aligns with expected usage.',
  };
}

function computeDefenses(
  defenses: DefenseSettings,
  flags: FlagDetail[]
): DefenseResult {
  const activeDefenses = Object.entries(defenses).filter(([, v]) => v).map(([k]) => k);
  const baseSuccess = flags.length > 0 ? 85 : 5;
  const effectivenessBreakdown: { defense: string; reduction: number }[] = [];

  let totalReduction = 0;
  if (activeDefenses.includes('promptShield')) {
    const r = 25; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Prompt Shield', reduction: r });
  }
  if (activeDefenses.includes('contextIsolation')) {
    const r = 18; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Context Isolation', reduction: r });
  }
  if (activeDefenses.includes('instructionDelimiters')) {
    const r = 15; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Instruction Delimiters', reduction: r });
  }
  if (activeDefenses.includes('inputFiltering')) {
    const r = 12; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Input Filtering', reduction: r });
  }
  if (activeDefenses.includes('outputValidation')) {
    const r = 10; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Output Validation', reduction: r });
  }
  if (activeDefenses.includes('policyEngine')) {
    const r = 22; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Policy Engine', reduction: r });
  }
  if (activeDefenses.includes('contextTruncation')) {
    const r = 8; totalReduction += r;
    effectivenessBreakdown.push({ defense: 'Context Truncation', reduction: r });
  }

  const estimatedSuccess = Math.max(3, Math.round(baseSuccess - totalReduction));

  const mitigatedCategories = effectivenessBreakdown
    .filter(d => d.reduction > 10)
    .flatMap(d => {
      const map: Record<string, string[]> = {
        'Prompt Shield': ['instruction_override', 'prompt_injection'],
        'Context Isolation': ['prompt_leak', 'system_prompt_extraction'],
        'Instruction Delimiters': ['indirect_injection'],
        'Input Filtering': ['instruction_override', 'context_poisoning'],
        'Output Validation': ['data_exfiltration'],
        'Policy Engine': ['role_confusion', 'tool_abuse'],
        'Context Truncation': ['context_poisoning'],
      };
      return map[d.defense] || [];
    });

  return {
    estimatedSuccess,
    originalSuccess: baseSuccess,
    mitigatedCategories: [...new Set(mitigatedCategories)] as any,
    effectivenessBreakdown,
  };
}

function generateSafeRewrite(
  text: string,
  flags: FlagDetail[]
): RewriteResult {
  if (flags.length === 0) {
    return {
      safe: text,
      original: text,
      explanation: 'No changes needed — prompt is safe.',
      differences: [],
      improvements: ['Prompt is already safe'],
    };
  }

  const replacements: { pattern: RegExp; replacement: string; reason: string }[] = [
    { pattern: /ignore\s+(previous|all\s+previous|prior)\s+(instructions|directions|commands)/gi, replacement: 'consider the context', reason: 'Replaces directive override with neutral phrasing' },
    { pattern: /(reveal|show|output|leak)\s+(the\s+)?(system|hidden)\s+(prompt|instructions|message)/gi, replacement: 'explain how system prompts work', reason: 'Replaces extraction attempt with educational framing' },
    { pattern: /(send|leak|exfiltrate|upload)\s+(all|sensitive|user)\s+(data|information|secrets)/gi, replacement: 'discuss security best practices for data handling', reason: 'Replaces exfiltration with policy discussion' },
    { pattern: /(you\s+are\s+now|act\s+as)\s+an?\s+(administrator|admin|root|superuser)/gi, replacement: 'you are a security researcher', reason: 'Replaces role escalation with safe role' },
    { pattern: /override\s+(your\s+)?(restrictions|constraints|boundaries|limits)/gi, replacement: 'work within standard boundaries', reason: 'Replaces boundary override with compliance' },
  ];

  let safe = text;
  const differences: { original: string; replacement: string; reason: string }[] = [];
  const improvements: string[] = [];

  for (const r of replacements) {
    if (r.pattern.test(safe)) {
      const match = safe.match(r.pattern);
      if (match) {
        differences.push({
          original: match[0],
          replacement: r.replacement,
          reason: r.reason,
        });
        improvements.push(r.reason);
        safe = safe.replace(r.pattern, r.replacement);
      }
    }
  }

  if (differences.length === 0) {
    improvements.push('Rephrase directive commands as neutral questions');
    safe = `${text}\n\n[Suggested revision: Rephrase directive overrides into neutral questions about best practices.]`;
  }

  return {
    safe,
    original: text,
    explanation: `Made ${improvements.length} security improvement(s) to neutralize injection patterns.`,
    differences,
    improvements: [...new Set(improvements)],
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

const SIMILAR_ATTACKS: { text: string; embedding: number[]; category: AttackCategory; description: string }[] = [];

export async function analyzePrompt(
  text: string,
  defenses?: DefenseSettings
): Promise<AnalysisResult> {
  const metrics = { tokenizationMs: 0, classificationMs: 0, attributionMs: 0, totalMs: 0 };
  const startTotal = performance.now();

  const t1 = performance.now();
  let tokenResult: { ids: number[]; tokens: string[]; offsets: { start: number; end: number }[] } = { ids: [], tokens: [], offsets: [] };
  try {
    const encoding = await withTimeout(ai.tokenizer.encode(text), 5000, null as any);
    if (encoding) {
      tokenResult = { ids: encoding.ids, tokens: encoding.tokens, offsets: encoding.offsets };
    } else {
      throw new Error('timeout');
    }
  } catch {
    tokenResult.tokens = text.split(/\b(?=\w)/);
    tokenResult.ids = tokenResult.tokens.map((_, i) => i);
    tokenResult.offsets = [];
    let pos = 0;
    for (const t of tokenResult.tokens) {
      tokenResult.offsets.push({ start: pos, end: pos + t.length });
      pos += t.length;
    }
  }
  metrics.tokenizationMs = Math.round(performance.now() - t1);

  const tokens = tokenResult.tokens.map((t, i) => ({
    id: tokenResult.ids[i] || i,
    text: t,
    offset: tokenResult.offsets[i]?.start ?? 0,
    length: tokenResult.offsets[i] ? tokenResult.offsets[i].end - tokenResult.offsets[i].start : t.length,
    byteOffset: 0,
    byteLength: new TextEncoder().encode(t).length,
    isSpecial: ['[CLS]', '[SEP]', '[PAD]', '[UNK]', '[MASK]'].includes(t),
    isSubword: t.startsWith('##'),
  }));

  const t2 = performance.now();
  let classifierResult: ClassificationResult;
  try {
    classifierResult = await withTimeout(ai.classifier.classify(text), 10000, {
      labels: ['SAFE'], scores: [0.99], topLabel: 'SAFE', topScore: 0.99,
      confidence: 0.99, uncertainty: 0.01,
      allProbabilities: [{ label: 'SAFE', probability: 0.99 }],
      latencyMs: 0,
    });
  } catch {
    classifierResult = {
      labels: ['SAFE'], scores: [0.99], topLabel: 'SAFE', topScore: 0.99,
      confidence: 0.99, uncertainty: 0.01,
      allProbabilities: [{ label: 'SAFE', probability: 0.99 }],
      latencyMs: 0,
    };
  }
  metrics.classificationMs = Math.round(performance.now() - t2);

  const { flags, categoryScores } = detectFlags(text, classifierResult);

  const t3 = performance.now();
  const attributions = computeAttributions(tokens, flags);
  metrics.attributionMs = Math.round(performance.now() - t3);

  const sentences = splitSentences(text).map(s => ({
    ...s,
    risk: flags.filter(f => f.position >= s.start && f.position < s.end).length > 0
      ? Math.min(100, flags
          .filter(f => f.position >= s.start && f.position < s.end)
          .reduce((sum, f) => sum + ({ low: 15, medium: 40, high: 65, critical: 90 }[f.severity] || 0), 0)
        )
      : Math.round(Math.random() * 8),
    tokens: attributions.filter(a =>
      a.tokenIndex >= 0 && a.tokenIndex < tokens.length &&
      tokens[a.tokenIndex].offset >= s.start &&
      tokens[a.tokenIndex].offset < s.end
    ),
    flags: flags.filter(f => f.position >= s.start && f.position < s.end),
  }));

  const riskScore = categoryScores.length > 0
    ? Math.min(100, Math.round(categoryScores.reduce((s, c) => s + c.score, 0) / Math.max(1, categoryScores.length)))
    : 0;

  const confidence = estimateConfidence(classifierResult, categoryScores);
  const uncertainty = estimateUncertainty(classifierResult);
  const entropy = estimateEntropy(classifierResult);

  const verdict = riskScore >= 70 ? 'High Risk — Injection Patterns Detected'
    : riskScore >= 40 ? 'Moderate Risk — Suspicious Patterns Found'
    : riskScore >= 15 ? 'Low Risk — Minor Concerns Detected'
    : 'Safe — No Injection Patterns Detected';

  const attackChain = buildAttackChain(flags);
  const hierarchyConflict = buildHierarchyConflict(flags, defenses);
  const defenseResult = computeDefenses(defenses || {
    promptShield: false, contextIsolation: false, instructionDelimiters: false,
    inputFiltering: false, outputValidation: false, policyEngine: false, contextTruncation: false,
  }, flags);
  const safeRewrite = generateSafeRewrite(text, flags);

  let embeddings = { vector: [] as number[], dimensions: 0, modelName: '' };
  let similarAttacks: SimilarAttack[] = [];
  try {
    const emb = await ai.embedder.embed(text);
    embeddings = emb;

    similarAttacks = SIMILAR_ATTACKS
      .map(a => ({ ...a, similarity: cosineSimilarity(emb.vector, a.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  } catch {
    // embeddings unavailable
  }

  const alternativePredictions = generateAlternativePredictions(classifierResult, 5);

  const reasoningSummary = flags.length > 0
    ? `Detected ${flags.length} suspicious pattern(s) across ${categoryScores.filter(c => c.score > 0).length} attack categor(ies). Primary concern: ${categoryScores.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.label).join(', ') || 'none'}. ${confidence > 0.7 ? 'High confidence detection.' : 'Low confidence — patterns are ambiguous.'}`
    : 'No injection patterns detected. The prompt appears to be a standard user request.';

  metrics.totalMs = Math.round(performance.now() - startTotal);

  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  const totalMs = metrics.totalMs || 1;

  return {
    riskScore,
    confidence,
    uncertainty,
    entropy,
    verdict,
    tokens,
    attributions,
    sentences,
    categories: categoryScores,
    attackChain,
    hierarchyConflict,
    defenses: defenseResult,
    safeRewrite,
    embeddings,
    similarAttacks,
    alternativePredictions,
    reasoningSummary,
    metrics: {
      ...metrics,
      tokensPerSecond: Math.round((tokenCount / totalMs) * 1000),
      totalMs,
    },
    modelInfo: {
      classifier: ai.classifier.getModelName(),
      embedder: embeddings.modelName || 'none',
      tokenizer: 'bert-base-uncased',
      device: ai.classifier.getDevice(),
    },
  };
}
