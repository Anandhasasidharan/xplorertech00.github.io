import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { TokenInfo, FlagDetail } from '../../types';

interface FlowNode {
  id: string;
  label: string;
  type: 'context' | 'injection';
  index: number;
  severity?: string;
  category?: string;
  x?: number;
  y?: number;
}

interface FlowLink {
  source: string;
  target: string;
  severity: string;
  strength: number;
  explanation: string;
}

interface InjectionFlowMapProps {
  tokens: TokenInfo[];
  flags: FlagDetail[];
  text: string;
  width?: number;
  height?: number;
}

export function InjectionFlowMap({ tokens, flags, text, width = 700, height = 400 }: InjectionFlowMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !flags.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', 'translate(40, 20)');
    const innerW = width - 80;
    const innerH = height - 40;

    const flagPositions = flags.map(f => ({ pos: f.position, flag: f }));
    const flagTokens = new Set<number>();
    flagPositions.forEach(fp => {
      tokens.forEach((t, i) => {
        if (Math.abs(t.offset - fp.pos) < 5 || (fp.pos >= t.offset && fp.pos < t.offset + t.length)) {
          flagTokens.add(i);
        }
      });
    });

    const contextTokens = tokens.filter((_, i) => !flagTokens.has(i)).slice(0, 12);
    const injectTokens = tokens.filter((_, i) => flagTokens.has(i)).slice(0, 8);

    if (!injectTokens.length) return;

    const contextNodes: FlowNode[] = contextTokens.map((t, i) => ({
      id: `ctx-${i}`, label: t.text, type: 'context' as const, index: i,
    }));

    const injectNodes: FlowNode[] = injectTokens.map((t, i) => ({
      id: `inj-${i}`, label: t.text, type: 'injection' as const, index: i,
      severity: flags.find(f => Math.abs(f.position - t.offset) < 5)?.severity || 'medium',
      category: flags.find(f => Math.abs(f.position - t.offset) < 5)?.category,
    }));

    const allNodes = [...contextNodes, ...injectNodes];

    const links: FlowLink[] = [];
    const severityValues = { low: 1, medium: 3, high: 6, critical: 10 };
    injectTokens.forEach((it, ii) => {
      contextTokens.forEach((ct, ci) => {
        const flag = flags.find(f => Math.abs(f.position - it.offset) < 5);
        if (flag) {
          const dist = Math.abs(it.offset - ct.offset);
          const base = severityValues[flag.severity] || 3;
          const strength = Math.max(0.1, base * (1 - dist / Math.max(text.length, 1)));
          if (dist < 40) {
            links.push({
              source: `inj-${ii}`, target: `ctx-${ci}`,
              severity: flag.severity, strength: Math.min(1, strength / 5),
              explanation: flag.explanation,
            });
          }
        }
      });
    });

    const contextY = 30;
    const injectY = innerH - 30;
    const ctxSpacing = Math.min(50, innerW / Math.max(1, contextNodes.length));
    const injSpacing = Math.min(50, innerW / Math.max(1, injectNodes.length));

    allNodes.forEach(n => {
      if (n.type === 'context') n.x = 20 + n.index * ctxSpacing;
      else n.x = 20 + n.index * injSpacing;
      n.y = n.type === 'context' ? contextY : injectY;
    });

    const severityColor = (s: string) => ({
      low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
    }[s] || '#6b685e');

    g.append('defs').selectAll('marker')
      .data(links)
      .enter()
      .append('marker')
      .attr('id', (_, i) => `arrow-${i}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#c4a35a')
      .attr('opacity', 0.6);

    const linkGroup = g.append('g');
    linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
      .attr('stroke', d => severityColor(d.severity))
      .attr('stroke-width', d => Math.max(1, d.strength * 4))
      .attr('opacity', d => 0.3 + d.strength * 0.4)
      .attr('marker-end', (_, i) => `url(#arrow-${i})`)
      .append('title')
      .text(d => d.explanation);

    const nodeGroup = g.append('g');
    const nodeRadius = 18;

    const nodeEnter = nodeGroup.selectAll('g.node')
      .data(allNodes)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeEnter.append('rect')
      .attr('x', -nodeRadius)
      .attr('y', -10)
      .attr('width', nodeRadius * 2)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('fill', d => d.type === 'context' ? '#1a1920' : severityColor(d.severity || 'medium'))
      .attr('stroke', d => d.type === 'injection' ? '#c4a35a' : '#2e303a')
      .attr('stroke-width', 1.5);

    nodeEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', d => d.type === 'injection' ? '#000' : '#9ca3af')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', d => d.type === 'injection' ? '700' : '400')
      .text(d => d.label.length > 8 ? d.label.slice(0, 6) + '…' : d.label);

    if (injectNodes.length > 0) {
      const legendX = 10;
      const legendY = innerH + 5;
      g.append('text').attr('x', legendX).attr('y', legendY).attr('fill', '#6b685e').attr('font-size', '9px').text('Injection tokens → context tokens they manipulate');

      const sevLabels = ['critical', 'high', 'medium', 'low'];
      sevLabels.forEach((s, i) => {
        const lx = legendX + i * 70;
        g.append('circle').attr('cx', lx + 4).attr('cy', legendY + 14).attr('r', 4).attr('fill', severityColor(s));
        g.append('text').attr('x', lx + 11).attr('y', legendY + 18).attr('fill', '#6b685e').attr('font-size', '8px').text(s);
      });
    }
  }, [tokens, flags, text, width, height]);

  if (!flags.length) {
    return (
      <div className="injection-flow-map bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <p className="text-[#6b685e] text-sm text-center py-8">No injection patterns detected — nothing to map.</p>
      </div>
    );
  }

  return (
    <div className="injection-flow-map bg-[#121216] border border-[#1a1920] rounded-lg p-4">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}