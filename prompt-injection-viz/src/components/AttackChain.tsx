import { useStore } from '../store';
import { AttackChainSankey } from '../visualization/sankey';

export function AttackChain() {
  const result = useStore((s) => s.result);

  if (!result) return null;

  return (
    <div className="attack-chain">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Attack Chain</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          Visualizes how the prompt flows through potential attack vectors and impacts the model.
        </p>
        {result.attackChain.length > 0 ? (
          <AttackChainSankey
            chain={result.attackChain}
            width={600}
            height={220}
          />
        ) : (
          <p className="text-[#9ca3af] text-sm py-4 text-center">No attack chain to display.</p>
        )}
        <div className="flex gap-3 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-[#6b685e]">Safe</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-[#6b685e]">Warning</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-[#6b685e]">Danger</span>
          </div>
        </div>
      </div>
    </div>
  );
}
