import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ChainNode } from '../../types';

interface AttackChainSankeyProps {
  chain: ChainNode[];
  width?: number;
  height?: number;
}

export function AttackChainSankey({ chain, width = 600, height = 300 }: AttackChainSankeyProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !chain.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodeWidth = 120;
    const totalWidth = Math.max(width, chain.length * (nodeWidth + 40));
    const effectiveWidth = totalWidth - 40;
    const nodeStep = effectiveWidth / Math.max(1, chain.length - 1);

    const g = svg.append('g').attr('transform', 'translate(20,20)');
    const innerHeight = height - 40;

    const severityColors: Record<string, string> = {
      safe: '#22c55e',
      warning: '#eab308',
      danger: '#ef4444',
    };

    chain.forEach((node, i) => {
      const x = i * nodeStep;
      const y = innerHeight / 2 - 15;

      const color = severityColors[node.severity] || '#9ca3af';

      g.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', nodeWidth)
        .attr('height', 30)
        .attr('fill', color)
        .attr('rx', 6)
        .attr('opacity', 0.85)
        .append('title')
        .text(`${node.label}\n${node.description}`);

      g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', y + 19)
        .attr('text-anchor', 'middle')
        .attr('fill', '#000')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text(node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label);

      if (i < chain.length - 1) {
        const nextX = (i + 1) * nodeStep;
        const midX = (x + nodeWidth + nextX) / 2;

        g.append('line')
          .attr('x1', x + nodeWidth)
          .attr('y1', innerHeight / 2)
          .attr('x2', nextX)
          .attr('y2', innerHeight / 2)
          .attr('stroke', '#4a4a5a')
          .attr('stroke-width', 2);

        g.append('polygon')
          .attr('points', `${midX - 1},${innerHeight / 2 - 5} ${midX + 6},${innerHeight / 2} ${midX - 1},${innerHeight / 2 + 5}`)
          .attr('fill', '#4a4a5a');

        g.append('text')
          .attr('x', midX)
          .attr('y', innerHeight / 2 - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#6b685e')
          .attr('font-size', '8px')
          .text('▸');
      }
    });
  }, [chain, width, height]);

  return (
    <div className="attack-chain-sankey">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }} />
    </div>
  );
}
