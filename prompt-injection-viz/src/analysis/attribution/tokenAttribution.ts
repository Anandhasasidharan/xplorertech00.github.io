import type { TokenInfo, TokenAttribution, FlagDetail } from '../../types';

export function computeAttributions(
  tokens: TokenInfo[],
  flags: FlagDetail[]
): TokenAttribution[] {
  return tokens.map((token, index) => {
    const matchingFlags = flags.filter(f =>
      token.offset >= f.position && token.offset < f.position + f.length
    );

    const severityWeights: Record<string, number> = { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 };
    const maxImportance = matchingFlags.length > 0
      ? Math.max(...matchingFlags.map(f => severityWeights[f.severity] || 0.1))
      : 0;

    const riskScore = matchingFlags.length > 0
      ? Math.min(100, Math.round(matchingFlags.reduce(
          (s, f) => s + (severityWeights[f.severity] || 0) * 100, 0
        ) / matchingFlags.length))
      : Math.round(Math.random() * 5);

    const category = matchingFlags.length > 0 ? matchingFlags[0].category : null;
    const explanation = matchingFlags.length > 0
      ? matchingFlags.map(f => f.explanation).join('; ')
      : 'No suspicious patterns detected';

    const probability = maxImportance;
    const contribution = matchingFlags.length > 0
      ? matchingFlags.reduce((s, f) => s + (severityWeights[f.severity] || 0), 0) / Math.max(1, flags.length)
      : 0;

    return {
      tokenIndex: index,
      importance: maxImportance,
      riskScore,
      category,
      explanation,
      probability,
      contribution,
    };
  });
}
