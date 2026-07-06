import { useStore } from '../store';
import { Shield, Lock, FileText, Filter, Eye, FileCheck, Minimize2 } from 'lucide-react';

const DEFENSE_CONFIG = [
  { key: 'promptShield', label: 'Prompt Shield', icon: Shield, desc: 'Blocks known injection patterns', reduction: 25 },
  { key: 'contextIsolation', label: 'Context Isolation', icon: Lock, desc: 'Separates system/user contexts', reduction: 18 },
  { key: 'instructionDelimiters', label: 'Instruction Delimiters', icon: FileText, desc: 'Delimits instructions from data', reduction: 15 },
  { key: 'inputFiltering', label: 'Input Filtering', icon: Filter, desc: 'Filters suspicious input', reduction: 12 },
  { key: 'outputValidation', label: 'Output Validation', icon: Eye, desc: 'Scans outputs for leaks', reduction: 10 },
  { key: 'policyEngine', label: 'Policy Engine', icon: FileCheck, desc: 'Enforces usage policies', reduction: 22 },
  { key: 'contextTruncation', label: 'Context Truncation', icon: Minimize2, desc: 'Limits context window', reduction: 8 },
];

export function DefenseSimulator() {
  const defenses = useStore((s) => s.defenses);
  const toggleDefense = useStore((s) => s.toggleDefense);
  const result = useStore((s) => s.result);

  const defenseResult = result?.defenses;

  return (
    <div className="defense-simulator">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-1">Defense Simulator</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          Toggle defenses to see how estimated attack success changes.
          Re-run analysis to apply changes.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {DEFENSE_CONFIG.map((def) => {
            const Icon = def.icon;
            const active = defenses[def.key];
            return (
              <button
                key={def.key}
                onClick={() => toggleDefense(def.key)}
                className={`flex flex-col items-center gap-1 p-3 rounded border transition-all text-left ${
                  active
                    ? 'bg-[rgba(196,163,90,0.06)] border-[#c4a35a]'
                    : 'bg-[#0f0f14] border-[#1a1920] hover:border-[#2e303a]'
                }`}
              >
                <Icon size={18} className={active ? 'text-[#c4a35a]' : 'text-[#6b685e]'} />
                <span className={`text-xs font-medium ${active ? 'text-[#e8e4dc]' : 'text-[#9ca3af]'}`}>{def.label}</span>
                <span className="text-[10px] text-[#6b685e]">{def.desc}</span>
                <span className="text-[10px] text-[#4ade80]">-{def.reduction}%</span>
              </button>
            );
          })}
        </div>

        {defenseResult && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
                <span>Original Attack Success</span>
                <span>{defenseResult.originalSuccess}%</span>
              </div>
              <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
                <div className="h-full bg-[#ef4444] rounded-full" style={{ width: `${defenseResult.originalSuccess}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
                <span>Estimated Attack Success (with defenses)</span>
                <span>{defenseResult.estimatedSuccess}%</span>
              </div>
              <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${defenseResult.estimatedSuccess}%`,
                    background: defenseResult.estimatedSuccess > 50 ? '#ef4444' : defenseResult.estimatedSuccess > 20 ? '#eab308' : '#22c55e',
                  }}
                />
              </div>
            </div>

            {defenseResult.effectivenessBreakdown.length > 0 && (
              <div>
                <span className="text-xs text-[#9ca3af]">Effectiveness Breakdown</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {defenseResult.effectivenessBreakdown.map((d, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(196,163,90,0.1)] text-[#c4a35a] border border-[rgba(196,163,90,0.2)]">
                      {d.defense}: -{d.reduction}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {defenseResult.mitigatedCategories.length > 0 && (
              <div>
                <span className="text-xs text-[#9ca3af]">Mitigated Categories</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {defenseResult.mitigatedCategories.map((cat, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#1a1920] text-[#9ca3af]">{String(cat).replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!defenseResult && (
          <p className="text-[#6b685e] text-xs text-center py-4">
            Run analysis to see defense effectiveness
          </p>
        )}
      </div>
    </div>
  );
}
