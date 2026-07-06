import { useStore } from '../store';

export function TokenDisplay() {
  const tokens = useStore((s) => s.result?.tokens);
  const selectedToken = useStore((s) => s.selectedToken);
  const setSelectedToken = useStore((s) => s.setSelectedToken);

  if (!tokens || tokens.length === 0) return null;

  const displayTokens = tokens.slice(0, 100);

  return (
    <div className="token-display">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-1">Token Analysis</h3>
        <p className="text-[#6b685e] text-xs mb-3">
          Tokenizer.js tokenization — showing {Math.min(displayTokens.length, 100)} of {tokens.length} tokens.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1a1920]">
                <th className="text-left text-[#6b685e] py-1 pr-2">#</th>
                <th className="text-left text-[#6b685e] py-1 px-2">Token</th>
                <th className="text-right text-[#6b685e] py-1 px-2">ID</th>
                <th className="text-right text-[#6b685e] py-1 px-2">Offset</th>
                <th className="text-right text-[#6b685e] py-1 pl-2">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {displayTokens.map((t, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedToken(selectedToken === i ? null : i)}
                  className={`border-b border-[#1a1920]/50 cursor-pointer transition-colors ${
                    selectedToken === i ? 'bg-[rgba(196,163,90,0.1)]' : 'hover:bg-[#0f0f14]'
                  }`}
                >
                  <td className="py-1 pr-2 text-[#6b685e]">{i}</td>
                  <td className={`py-1 px-2 ${t.isSpecial ? 'text-[#eab308]' : t.isSubword ? 'text-[#4488ff]' : 'text-[#e8e4dc]'}`}>
                    {t.text || '·'}
                    {t.isSpecial && <span className="text-[10px] text-[#eab308] ml-1">[SPECIAL]</span>}
                    {t.isSubword && <span className="text-[10px] text-[#4488ff] ml-1">##</span>}
                  </td>
                  <td className="py-1 px-2 text-right text-[#9ca3af]">{t.id}</td>
                  <td className="py-1 px-2 text-right text-[#9ca3af]">{t.offset}-{t.offset + t.length}</td>
                  <td className="py-1 pl-2 text-right text-[#9ca3af]">{t.byteOffset}-{t.byteOffset + t.byteLength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tokens.length > 100 && (
          <p className="text-[#6b685e] text-[10px] mt-2 text-center">
            Showing first 100 tokens. {tokens.length - 100} more truncated.
          </p>
        )}
      </div>
    </div>
  );
}
