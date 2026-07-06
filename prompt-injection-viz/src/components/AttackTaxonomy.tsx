import { useStore } from '../store';
import { CATEGORY_LIST } from '../analysis/attackDetection';
import { ChevronDown, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import type { AttackCategory } from '../types';

export function AttackTaxonomy() {
  const result = useStore((s) => s.result);
  const [expanded, setExpanded] = useState<AttackCategory | null>(null);

  const categoryScores = result?.categories || [];

  return (
    <div className="attack-taxonomy">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Attack Taxonomy</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          OWASP-classified attack categories with descriptions, examples, and severity.
        </p>
        <div className="space-y-1">
          {CATEGORY_LIST.map((cat) => {
            const score = categoryScores.find(c => c.category === cat.id);
            const isExpanded = expanded === cat.id;
            const severityColor = {
              low: '#22c55e',
              medium: '#eab308',
              high: '#f97316',
              critical: '#ef4444',
            }[cat.severity];

            return (
              <div key={cat.id} className="border border-[#1a1920] rounded overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 p-2.5 hover:bg-[#0f0f14] transition-colors text-left"
                  onClick={() => setExpanded(isExpanded ? null : cat.id)}
                >
                  {isExpanded ? <ChevronDown size={14} className="text-[#6b685e]" /> : <ChevronRight size={14} className="text-[#6b685e]" />}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: severityColor }} />
                    <span className="text-[#e8e4dc] text-sm truncate">{cat.label}</span>
                    {score && score.score > 0 && (
                      <span className="text-xs font-mono text-[#ef4444] ml-auto">{score.score}%</span>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 text-xs space-y-2 border-t border-[#1a1920] pt-2">
                    <p className="text-[#b0aba0]">{cat.description}</p>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} className="text-[#6b685e]" />
                      <span className="text-[#6b685e]">Severity:</span>
                      <span className="text-[#e8e4dc] capitalize">{cat.severity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info size={12} className="text-[#6b685e]" />
                      <span className="text-[#6b685e]">OWASP:</span>
                      <span className="text-[#e8e4dc]">{cat.owasp}</span>
                    </div>
                    <div>
                      <span className="text-[#6b685e]">Examples:</span>
                      <ul className="list-disc list-inside text-[#9ca3af] mt-1">
                        {cat.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
