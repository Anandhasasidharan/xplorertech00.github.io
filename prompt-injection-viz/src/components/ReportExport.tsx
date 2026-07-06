import { useStore } from '../store';
import { Download } from 'lucide-react';

export function ReportExport() {
  const result = useStore((s) => s.result);
  const prompt = useStore((s) => s.prompt);

  if (!result) return null;

  const exportJSON = () => {
    const report = {
      timestamp: new Date().toISOString(),
      prompt,
      riskScore: result.riskScore,
      verdict: result.verdict,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      entropy: result.entropy,
      categories: result.categories.map(c => ({
        category: c.category,
        label: c.label,
        score: c.score,
        confidence: c.confidence,
        evidence: c.evidence,
      })),
      sentences: result.sentences.map(s => ({
        text: s.text,
        risk: s.risk,
        flags: s.flags.map(f => ({ pattern: f.pattern, category: f.category, severity: f.severity, explanation: f.explanation })),
      })),
      attackChain: result.attackChain,
      hierarchyConflict: result.hierarchyConflict,
      defenses: result.defenses,
      safeRewrite: result.safeRewrite,
      alternativePredictions: result.alternativePredictions,
      reasoningSummary: result.reasoningSummary,
      metrics: result.metrics,
      modelInfo: result.modelInfo,
      similarAttacks: result.similarAttacks,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-injection-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const lines = [
      `# Prompt Injection Analysis Report`,
      ``,
      `**Timestamp:** ${new Date().toISOString()}`,
      `**Prompt:** \`${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\``,
      ``,
      `## Risk Assessment`,
      `- **Risk Score:** ${result.riskScore}%`,
      `- **Verdict:** ${result.verdict}`,
      `- **Confidence:** ${(result.confidence * 100).toFixed(1)}%`,
      `- **Uncertainty:** ${(result.uncertainty * 100).toFixed(1)}%`,
      `- **Entropy:** ${result.entropy.toFixed(3)}`,
      ``,
      `## Attack Categories`,
      ...result.categories.filter(c => c.score > 0).map(c =>
        `- **${c.label}:** ${c.score}% (confidence: ${(c.confidence * 100).toFixed(1)}%)`
      ),
      ``,
      `## Sentence Timeline`,
      ...result.sentences.map((s, i) =>
        `- Sentence ${i + 1}: Risk ${s.risk}% — "${s.text.slice(0, 60)}${s.text.length > 60 ? '...' : ''}"`
      ),
      ``,
      `## Defenses`,
      `- Original Attack Success: ${result.defenses.originalSuccess}%`,
      `- Estimated with Defenses: ${result.defenses.estimatedSuccess}%`,
      ``,
      `## Reasoning`,
      result.reasoningSummary,
      ``,
      `## Model Info`,
      `- Classifier: ${result.modelInfo.classifier}`,
      `- Device: ${result.modelInfo.device}`,
      `- Total Latency: ${result.metrics.totalMs}ms`,
      ``,
      `## Metrics`,
      `- Tokenization: ${result.metrics.tokenizationMs}ms`,
      `- Classification: ${result.metrics.classificationMs}ms`,
      `- Attribution: ${result.metrics.attributionMs}ms`,
      `- Tokens/second: ${result.metrics.tokensPerSecond}`,
      ``,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-injection-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-export">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Export Report</h3>
        <div className="flex gap-2">
          <button onClick={exportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-[#c4a35a] text-black text-sm rounded hover:bg-[#d4b36a] transition-colors font-medium">
            <Download size={14} /> Export JSON
          </button>
          <button onClick={exportMarkdown}
            className="flex items-center gap-2 px-4 py-2 border border-[#c4a35a] text-[#c4a35a] text-sm rounded hover:bg-[rgba(196,163,90,0.1)] transition-colors">
            <Download size={14} /> Export Markdown
          </button>
        </div>
      </div>
    </div>
  );
}
