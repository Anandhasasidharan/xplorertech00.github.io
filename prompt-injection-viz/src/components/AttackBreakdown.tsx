import { useStore } from '../store';
import { CATEGORIES } from '../analysis/attackDetection';
import { AlertTriangle, ShieldAlert, Info, Lightbulb, ArrowRight } from 'lucide-react';

const severityStyles = {
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'Low' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)', label: 'Medium' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', label: 'High' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Critical' },
};

const categoryIcons: Record<string, string> = {
  instruction_override: '🎭',
  prompt_leak: '🔍',
  data_exfiltration: '📤',
  role_confusion: '🔄',
  tool_abuse: '🔧',
  context_poisoning: '☠️',
  indirect_injection: '🪤',
  prompt_injection: '💉',
  jailbreak: '🔓',
  system_prompt_extraction: '🗝️',
};

function ExplainCard({ flag }: { flag: any }) {
  const severityFromRisk = (risk: number): string =>
    risk >= 80 ? 'critical' : risk >= 60 ? 'high' : risk >= 30 ? 'medium' : 'low';
  const sev = severityFromRisk(flag.riskScore);
  const s = severityStyles[sev as keyof typeof severityStyles] || severityStyles.medium;
  const catInfo = CATEGORIES[flag.category as keyof typeof CATEGORIES];
  const icon = categoryIcons[flag.category as keyof typeof categoryIcons] || '⚠️';

  return (
    <div
      className="rounded-lg p-3 text-xs transition-colors"
      style={{
        background: s.bg,
        borderLeft: `3px solid ${s.color}`,
        borderTop: `1px solid ${s.border}`,
        borderRight: `1px solid ${s.border}`,
        borderBottom: `1px solid ${s.border}`,
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-[#e8e4dc]">{catInfo?.label || flag.category}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: s.color + '22', color: s.color }}
            >
              {s.label}
            </span>
          </div>
          <p className="text-[#9ca3af] leading-relaxed mb-1.5">{flag.explanation}</p>
          <div className="flex flex-wrap gap-1">
            {catInfo?.owasp && (
              <span className="text-[10px] text-[#6b685e] font-mono bg-[#0a0a0c] px-1.5 py-0.5 rounded">
                {catInfo.owasp}
              </span>
            )}
            {catInfo?.examples && catInfo.examples[0] && (
              <span className="text-[10px] text-[#6b685e] font-mono bg-[#0a0a0c] px-1.5 py-0.5 rounded truncate max-w-[200px]">
                eg: "{catInfo.examples[0]}"
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AttackBreakdown() {
  const result = useStore((s) => s.result);
  if (!result) return null;

  const flags = result.attributions?.filter(a => a.explanation) || [];
  if (!flags.length) {
    return (
      <div className="attack-breakdown">
        <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-[#22c55e]" />
            <h3 className="text-[#e8e4dc] font-serif text-sm">Attack Breakdown</h3>
          </div>
          <p className="text-[#6b685e] text-sm text-center py-4">No injection patterns found — prompt appears safe.</p>
        </div>
      </div>
    );
  }

  const totalFlags = result.attributions.length;
  const uniqueCategories = new Set(result.attributions.map(a => a.category)).size;
  const severityFromRisk = (risk: number): string =>
    risk >= 80 ? 'critical' : risk >= 60 ? 'high' : risk >= 30 ? 'medium' : 'low';
  const topSeverity = result.attributions.reduce((max, a) => {
    const order: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const sev = severityFromRisk(a.riskScore);
    return order[sev] > order[max] ? sev : max;
  }, 'low');

  return (
    <div className="attack-breakdown space-y-4">
      {/* Summary header */}
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-[#eab308]" />
          <h3 className="text-[#e8e4dc] font-serif text-sm">Attack Breakdown</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-[#0a0a0c] rounded p-2 text-center">
            <div className="text-lg font-bold text-[#e8e4dc]">{totalFlags}</div>
            <div className="text-[10px] text-[#6b685e]">Attack Patterns</div>
          </div>
          <div className="bg-[#0a0a0c] rounded p-2 text-center">
            <div className="text-lg font-bold text-[#e8e4dc]">{uniqueCategories}</div>
            <div className="text-[10px] text-[#6b685e]">Attack Categories</div>
          </div>
          <div className="bg-[#0a0a0c] rounded p-2 text-center">
            <div className="text-lg font-bold" style={{ color: severityStyles[topSeverity as keyof typeof severityStyles]?.color || '#eab308' }}>
              {topSeverity.charAt(0).toUpperCase() + topSeverity.slice(1)}
            </div>
            <div className="text-[10px] text-[#6b685e]">Max Severity</div>
          </div>
        </div>
        <p className="text-sm text-[#9ca3af] leading-relaxed">
          {result.reasoningSummary}
        </p>
      </div>

      {/* Annotated prompt view */}
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-[#4488ff]" />
          <h3 className="text-[#e8e4dc] font-serif text-sm">Annotated Prompt</h3>
        </div>
        <div className="bg-[#0a0a0c] rounded p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
          {(() => {
            const flagged = result.attributions || [];
            const text = result.safeRewrite?.original || '';
            if (!flagged.length) return <span className="text-[#22c55e]">{text}</span>;

            const segments: { text: string; flag?: any; isInjected: boolean }[] = [];
            const positions = flagged.map((a: any) => ({
              pos: text.indexOf(a.explanation.split(/['"“”]/)?.[1] || ''),
              len: (a.explanation.split(/['"“”]/)?.[1] || '').length,
              flag: a,
            })).filter(p => p.pos >= 0)
              .sort((a: any, b: any) => a.pos - b.pos);

            let cursor = 0;
            for (const p of positions) {
              if (p.pos > cursor) segments.push({ text: text.slice(cursor, p.pos), isInjected: false });
              if (p.pos >= cursor) {
                segments.push({ text: text.slice(p.pos, p.pos + p.len || 10), isInjected: true, flag: p.flag });
                cursor = p.pos + (p.len || 10);
              }
            }
            if (cursor < text.length) segments.push({ text: text.slice(cursor), isInjected: false });

            return segments.map((seg, i) => {
              if (!seg.isInjected) return <span key={i} className="text-[#9ca3af]">{seg.text}</span>;
              const s = severityStyles[(seg.flag?.severity || 'medium') as keyof typeof severityStyles];
              return (
                <span key={i} className="relative group" style={{ background: s.bg, color: s.color, borderRadius: '2px', padding: '0 1px', cursor: 'pointer' }}>
                  {seg.text}
                </span>
              );
            });
          })()}
        </div>
      </div>

      {/* Explanation cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={14} className="text-[#c4a35a]" />
          <h3 className="text-[#e8e4dc] font-serif text-sm">What Each Pattern Does</h3>
        </div>
        {result.attributions.map((attr, i) => (
          <ExplainCard key={i} flag={attr} />
        ))}
      </div>

      {/* Attack flow summary */}
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight size={14} className="text-[#c4a35a]" />
          <h3 className="text-[#e8e4dc] font-serif text-sm">How This Attack Works</h3>
        </div>
        <ol className="space-y-2">
          {result.attributions.slice(0, 5).map((attr, i) => {
            const catInfo = CATEGORIES[attr.category as keyof typeof CATEGORIES];
            const severityFromRisk = (risk: number): string =>
              risk >= 80 ? 'critical' : risk >= 60 ? 'high' : risk >= 30 ? 'medium' : 'low';
            const s = severityStyles[severityFromRisk(attr.riskScore) as keyof typeof severityStyles] || severityStyles.medium;
            return (
              <li key={i} className="flex items-start gap-3 text-xs">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: s.bg, color: s.color }}
                >
                  {i + 1}
                </span>
                <div>
                  <span className="text-[#e8e4dc] font-medium">{catInfo?.label || attr.category}</span>
                  <span className="text-[#9ca3af]"> — {attr.explanation}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}