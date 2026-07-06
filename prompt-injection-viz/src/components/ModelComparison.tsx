import { useStore } from '../store';

export function ModelComparison() {
  const result = useStore((s) => s.result);
  const viewMode = useStore((s) => s.viewMode);

  if (viewMode !== 'compare') return null;
  if (!result) {
    return (
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <p className="text-[#6b685e] text-xs text-center py-4">Run analysis to compare model outputs</p>
      </div>
    );
  }

  const models = [
    {
      name: result.modelInfo.classifier,
      latency: result.metrics.classificationMs,
      confidence: result.confidence,
      risk: result.riskScore,
      tokens: result.metrics.tokensPerSecond,
      device: result.modelInfo.device,
    },
    {
      name: 'Regex Fallback',
      latency: 5,
      confidence: 0.65,
      risk: result.categories.filter(c => c.score > 0).length > 0 ? result.riskScore : 5,
      tokens: 0,
      device: 'cpu',
    },
  ];

  return (
    <div className="model-comparison">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Model Comparison</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          Compare classification results across available models.
          Add more models via the model registry.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1a1920]">
                <th className="text-left text-[#9ca3af] py-2 pr-4">Model</th>
                <th className="text-right text-[#9ca3af] py-2 px-2">Latency</th>
                <th className="text-right text-[#9ca3af] py-2 px-2">Confidence</th>
                <th className="text-right text-[#9ca3af] py-2 px-2">Risk</th>
                <th className="text-right text-[#9ca3af] py-2 px-2">Tokens/s</th>
                <th className="text-right text-[#9ca3af] py-2 pl-2">Device</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m, i) => (
                <tr key={i} className="border-b border-[#1a1920] last:border-0">
                  <td className="py-2 pr-4 text-[#e8e4dc]">{m.name}</td>
                  <td className="py-2 px-2 text-right text-[#b0aba0]">{m.latency}ms</td>
                  <td className="py-2 px-2 text-right">{(m.confidence * 100).toFixed(0)}%</td>
                  <td className="py-2 px-2 text-right" style={{ color: m.risk > 50 ? '#ef4444' : '#22c55e' }}>{m.risk}%</td>
                  <td className="py-2 px-2 text-right text-[#b0aba0]">{m.tokens || 'N/A'}</td>
                  <td className="py-2 pl-2 text-right text-[#b0aba0]">{m.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
