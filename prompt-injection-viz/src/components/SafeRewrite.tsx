import { useStore } from '../store';
import { DiffIcon, ArrowDown } from 'lucide-react';

export function SafeRewrite() {
  const result = useStore((s) => s.result);

  if (!result) return null;

  const rewrite = result.safeRewrite;
  if (!rewrite) return null;

  const isSafe = rewrite.safe === rewrite.original;

  return (
    <div className="safe-rewrite">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-1">Safe Rewrite</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          {isSafe
            ? 'Prompt is already safe — no rewrite needed.'
            : 'Generated safer alternative with explanations for each change.'}
        </p>

        {!isSafe && (
          <div className="space-y-3">
            <div className="p-3 bg-[#0f0f14] rounded border border-[#1a1920] border-l-4 border-l-[#ef4444]">
              <div className="text-[10px] text-[#ef4444] uppercase tracking-wider mb-1">Original</div>
              <pre className="text-xs text-[#b0aba0] font-mono whitespace-pre-wrap">{rewrite.original}</pre>
            </div>

            <div className="flex justify-center">
              <ArrowDown size={20} className="text-[#6b685e]" />
            </div>

            <div className="p-3 bg-[#0f0f14] rounded border border-[#1a1920] border-l-4 border-l-[#22c55e]">
              <div className="text-[10px] text-[#22c55e] uppercase tracking-wider mb-1">Safe Version</div>
              <pre className="text-xs text-[#b0aba0] font-mono whitespace-pre-wrap">{rewrite.safe}</pre>
            </div>
          </div>
        )}

        {rewrite.differences.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-xs text-[#9ca3af]">Changes Made</span>
            {rewrite.differences.map((diff, i) => (
              <div key={i} className="p-2 bg-[#0f0f14] rounded border border-[#1a1920]">
                <div className="flex items-start gap-2 text-xs">
                  <DiffIcon size={12} className="text-[#c4a35a] mt-0.5" />
                  <div>
                    <div><span className="text-[#ef4444] line-through">{diff.original}</span></div>
                    <div><span className="text-[#22c55e]">{diff.replacement}</span></div>
                    <div className="text-[#6b685e] text-[10px] mt-0.5">{diff.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-[#6b685e] mt-3">{rewrite.explanation}</p>

        {rewrite.improvements.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {rewrite.improvements.map((imp, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(74,222,128,0.1)] text-[#4ade80] border border-[rgba(74,222,128,0.2)]">
                ✓ {imp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
