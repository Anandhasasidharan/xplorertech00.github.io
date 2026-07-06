import { useStore } from '../store';

export function RiskScoreRing() {
  const result = useStore((s) => s.result);

  if (!result) return null;

  const score = result.riskScore;
  const confidence = result.confidence;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#eab308' : score >= 15 ? '#f97316' : '#22c55e';

  return (
    <div className="risk-score-ring flex items-center gap-6">
      <div className="flex-shrink-0">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#1a1920" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="65" y="58" textAnchor="middle" fill="#e8e4dc" fontSize="28" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {score}
          </text>
          <text x="65" y="78" textAnchor="middle" fill="#6b685e" fontSize="10" fontFamily="'JetBrains Mono', monospace">
            / 100
          </text>
        </svg>
      </div>
      <div>
        <div className={`text-base font-semibold font-serif ${
          score >= 70 ? 'text-[#ef4444]' : score >= 40 ? 'text-[#eab308]' : score >= 15 ? 'text-[#f97316]' : 'text-[#22c55e]'
        }`}>
          {result.verdict}
        </div>
        <div className="flex gap-4 mt-2 text-xs font-mono text-[#6b685e]">
          <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
          <span>Uncertainty: {(result.uncertainty * 100).toFixed(0)}%</span>
          <span>Latency: {result.metrics.totalMs}ms</span>
          <span>Tokens: {result.tokens.length}</span>
        </div>
      </div>
    </div>
  );
}
