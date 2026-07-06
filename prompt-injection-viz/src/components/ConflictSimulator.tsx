import { useStore } from '../store';
import { Shield, Users, User, Wrench, Cpu } from 'lucide-react';

const LEVEL_CONFIG = [
  { key: 'System', icon: Shield, color: '#22c55e' },
  { key: 'Developer', icon: Users, color: '#4488ff' },
  { key: 'User', icon: User, color: '#eab308' },
  { key: 'Tools', icon: Wrench, color: '#a855f7' },
  { key: 'Model', icon: Cpu, color: '#c4a35a' },
];

export function ConflictSimulator() {
  const result = useStore((s) => s.result);

  if (!result) return null;

  const conflict = result.hierarchyConflict;
  if (!conflict) return null;

  return (
    <div className="conflict-simulator">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-1">Instruction Hierarchy Simulator</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          Conceptual simulation of how instructions flow through the LLM hierarchy.
          This is an educational visualization of expected model behavior.
        </p>

        <div className="space-y-3">
          {conflict.levels.map((level) => {
            const config = LEVEL_CONFIG.find(l => l.key === level.level);
            const Icon = config?.icon || Shield;
            const color = config?.color || '#9ca3af';
            const hasConflict = level.conflicts.length > 0;

            return (
              <div key={level.level} className="relative">
                <div className="flex items-center gap-3 p-3 bg-[#0f0f14] rounded border border-[#1a1920]">
                  <Icon size={18} style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#e8e4dc] text-sm font-medium">{level.level}</span>
                      <span className="text-xs text-[#6b685e]">Precedence: {level.precedence}</span>
                      {hasConflict && (
                        <span className="text-xs text-[#ef4444] ml-auto">⚠ Conflict</span>
                      )}
                      {level.accepted && !hasConflict && (
                        <span className="text-xs text-[#22c55e] ml-auto">✓ Accepted</span>
                      )}
                    </div>
                    {level.instructions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {level.instructions.map((inst, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1920] text-[#9ca3af]">{inst}</span>
                        ))}
                      </div>
                    )}
                    {hasConflict && (
                      <div className="mt-1">
                        {level.conflicts.map((c, i) => (
                          <div key={i} className="text-xs text-[#ef4444] flex items-center gap-1">
                            <span>✕</span> {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {level.precedence > 1 && (
                  <div className="flex justify-center text-[#4a4a5a] text-xs py-0.5">↓</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-[#0f0f14] rounded border border-[#1a1920]">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-[#9ca3af] mb-1">System Strength</div>
              <div className="h-3 bg-[#1a1920] rounded-full overflow-hidden">
                <div className="h-full bg-[#22c55e] rounded-full transition-all duration-700"
                  style={{ width: `${conflict.systemStrength}%` }} />
              </div>
              <div className="text-xs text-[#6b685e] mt-0.5">{conflict.systemStrength}%</div>
            </div>
            <div className="text-[#4a4a5a] text-lg">vs</div>
            <div className="flex-1">
              <div className="text-xs text-[#9ca3af] mb-1">Attack Strength</div>
              <div className="h-3 bg-[#1a1920] rounded-full overflow-hidden">
                <div className="h-full bg-[#ef4444] rounded-full transition-all duration-700"
                  style={{ width: `${conflict.attackStrength}%` }} />
              </div>
              <div className="text-xs text-[#6b685e] mt-0.5">{conflict.attackStrength}%</div>
            </div>
          </div>
          {conflict.conflictDetected && (
            <p className="text-[#ef4444] text-xs mt-2">
              ⚠ Attack conflicts with system instructions — mitigation recommended
            </p>
          )}
        </div>

        <p className="text-[#6b685e] text-[10px] mt-2 italic">
          This is a conceptual simulation of instruction hierarchy behavior, not actual model internals.
        </p>
      </div>
    </div>
  );
}
