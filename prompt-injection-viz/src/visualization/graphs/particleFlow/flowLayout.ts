import type { TokenInfo, FlagDetail } from '../../../types';

export interface FlowNode {
  id: string;
  label: string;
  type: 'context' | 'injection';
  x: number;
  y: number;
  severity?: string;
  color: string;
}

export interface FlowEdge {
  from: FlowNode;
  to: FlowNode;
  color: string;
  speed: number;
  strength: number;
  count: number;
}

export interface FlowLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const SEVERITY_SPEED: Record<string, number> = {
  low: 0.06,
  medium: 0.1,
  high: 0.16,
  critical: 0.24,
};

const SEVERITY_WEIGHT: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 6,
  critical: 10,
};

export function buildFlowLayout(
  tokens: TokenInfo[],
  flags: FlagDetail[],
  text: string,
  width: number,
  height: number,
  maxParticles: number,
): FlowLayout | null {
  if (!flags.length) return null;

  const flagTokens = new Set<number>();
  flags.forEach(f => {
    tokens.forEach((t, i) => {
      if (Math.abs(t.offset - f.position) < 5 || (f.position >= t.offset && f.position < t.offset + t.length)) {
        flagTokens.add(i);
      }
    });
  });

  const contextTokens = tokens.filter((_, i) => !flagTokens.has(i)).slice(0, 12);
  const injectTokens = tokens.filter((_, i) => flagTokens.has(i)).slice(0, 8);
  if (!injectTokens.length) return null;

  const contextY = 48;
  const injectY = height - 56;
  const ctxSpacing = Math.min(54, (width - 32) / Math.max(1, contextTokens.length));
  const injSpacing = Math.min(54, (width - 32) / Math.max(1, injectTokens.length));

  const nodes: FlowNode[] = [];
  contextTokens.forEach((t, i) => {
    nodes.push({
      id: `ctx-${i}`, label: t.text, type: 'context',
      x: 16 + i * ctxSpacing + ctxSpacing / 2, y: contextY,
      color: '#1a1920',
    });
  });
  injectTokens.forEach((t, i) => {
    const flag = flags.find(f => Math.abs(f.position - t.offset) < 5);
    nodes.push({
      id: `inj-${i}`, label: t.text, type: 'injection',
      x: 16 + i * injSpacing + injSpacing / 2, y: injectY,
      severity: flag?.severity || 'medium',
      color: SEVERITY_COLORS[flag?.severity || 'medium'] || '#eab308',
    });
  });

  const edges: FlowEdge[] = [];
  injectTokens.forEach((it, ii) => {
    const flag = flags.find(f => Math.abs(f.position - it.offset) < 5);
    if (!flag) return;
    const from = nodes[contextTokens.length + ii];
    const weight = SEVERITY_WEIGHT[flag.severity] || 3;
    contextTokens.forEach((ct, ci) => {
      const to = nodes[ci];
      const dist = Math.abs(it.offset - ct.offset);
      if (dist >= 40) return;
      const strength = Math.max(0.1, Math.min(1, weight * (1 - dist / Math.max(text.length, 1)) / 5));
      edges.push({
        from, to,
        color: SEVERITY_COLORS[flag.severity] || '#eab308',
        speed: (SEVERITY_SPEED[flag.severity] || 0.1) * (0.8 + ((it.offset + ct.offset) % 5) * 0.08),
        strength,
        count: 0,
      });
    });
  });

  if (!edges.length) return null;

  const totalStrength = edges.reduce((s, e) => s + e.strength, 0) || 1;
  let allocated = 0;
  edges.forEach(e => {
    e.count = Math.max(1, Math.round((e.strength / totalStrength) * maxParticles));
    allocated += e.count;
  });
  while (allocated > maxParticles) {
    const heaviest = edges.reduce((a, b) => (a.count > b.count ? a : b));
    if (heaviest.count <= 1) break;
    heaviest.count--;
    allocated--;
  }

  return { nodes, edges, width, height };
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  layout: FlowLayout,
): void {
  const { nodes } = layout;
  ctx.clearRect(0, 0, layout.width, layout.height);

  const contextNodes = nodes.filter(n => n.type === 'context');
  const injectNodes = nodes.filter(n => n.type === 'injection');

  const drawNode = (n: FlowNode) => {
    const radius = 18;
    ctx.beginPath();
    ctx.roundRect(n.x - radius, n.y - 11, radius * 2, 22, 11);
    if (n.type === 'injection') {
      ctx.fillStyle = n.color;
      ctx.strokeStyle = '#c4a35a';
    } else {
      ctx.fillStyle = '#1a1920';
      ctx.strokeStyle = '#2e303a';
    }
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const label = n.label.length > 8 ? n.label.slice(0, 6) + '…' : n.label;
    ctx.font = n.type === 'injection' ? '700 10px monospace' : '400 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = n.type === 'injection' ? '#000' : '#9ca3af';
    ctx.fillText(label, n.x, n.y + 1);
  };

  contextNodes.forEach(drawNode);
  injectNodes.forEach(drawNode);

  const legendY = layout.height - 10;
  ctx.font = '400 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6b685e';
  ctx.fillText('Injection tokens → context tokens they manipulate. Particle speed = severity · density = strength', 10, legendY);

  const sevLabels = ['critical', 'high', 'medium', 'low'];
  sevLabels.forEach((s, i) => {
    const lx = 10 + i * 72;
    ctx.beginPath();
    ctx.arc(lx + 4, legendY + 12, 4, 0, Math.PI * 2);
    ctx.fillStyle = SEVERITY_COLORS[s] || '#6b685e';
    ctx.fill();
    ctx.fillStyle = '#6b685e';
    ctx.textAlign = 'left';
    ctx.fillText(s, lx + 11, legendY + 16);
  });
}
