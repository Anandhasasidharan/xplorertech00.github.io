import { useStore } from '../store';
import { AttentionHeatmap } from '../visualization/attention';

export function InterpretabilityDashboard() {
  const result = useStore((s) => s.result);
  const selectedToken = useStore((s) => s.selectedToken);

  if (!result) return null;

  const selectedAttribution = selectedToken !== null
    ? result.attributions[selectedToken]
    : null;

  return (
    <div className="interpretability-dashboard grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Token Importance</h3>
        <AttentionHeatmap
          tokens={result.tokens}
          attributions={result.attributions}
          width={500}
          height={200}
          title="Token Attribution Heatmap"
        />
        <p className="text-[#6b685e] text-xs mt-2">
          Redder tokens have higher importance in the classification decision.
          Hover for details.
        </p>
      </div>

      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Confidence & Uncertainty</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
              <span>Confidence</span>
              <span>{(result.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
              <div className="h-full bg-[#4ade80] rounded-full transition-all duration-500"
                style={{ width: `${result.confidence * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
              <span>Uncertainty</span>
              <span>{(result.uncertainty * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
              <div className="h-full bg-[#eab308] rounded-full transition-all duration-500"
                style={{ width: `${result.uncertainty * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
              <span>Entropy</span>
              <span>{result.entropy.toFixed(3)}</span>
            </div>
            <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
              <div className="h-full bg-[#4488ff] rounded-full transition-all duration-500"
                style={{ width: `${result.entropy * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-[#9ca3af] text-xs mb-2">Alternative Predictions</h4>
          {result.alternativePredictions.slice(0, 5).map((p, i) => (
            <div key={i} className="flex justify-between text-xs text-[#6b685e] py-0.5">
              <span>{p.label}</span>
              <span>{(p.probability * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4 col-span-full">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-2">Reasoning Summary</h3>
        <p className="text-[#b0aba0] text-sm">{result.reasoningSummary}</p>
      </div>

      {selectedAttribution && (
        <div className="bg-[#121216] border border-[#c4a35a] rounded-lg p-4 col-span-full">
          <h3 className="text-[#c4a35a] font-mono text-xs mb-2">Selected Token Detail</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#6b685e]">Token:</span>
              <span className="text-[#e8e4dc] ml-1">{result.tokens[selectedToken!]?.text || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[#6b685e]">Importance:</span>
              <span className="text-[#e8e4dc] ml-1">{(selectedAttribution.importance * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[#6b685e]">Risk:</span>
              <span className="text-[#e8e4dc] ml-1">{selectedAttribution.riskScore}%</span>
            </div>
            <div>
              <span className="text-[#6b685e]">Contribution:</span>
              <span className="text-[#e8e4dc] ml-1">{(selectedAttribution.contribution * 100).toFixed(1)}%</span>
            </div>
            <div className="col-span-full">
              <span className="text-[#6b685e]">Explanation:</span>
              <span className="text-[#b0aba0] ml-1">{selectedAttribution.explanation}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
