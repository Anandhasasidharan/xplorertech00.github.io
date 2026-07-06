import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { TokenAttribution, TokenInfo } from '../../types';

interface AttentionHeatmapProps {
  tokens: TokenInfo[];
  attributions: TokenAttribution[];
  width?: number;
  height?: number;
  title?: string;
}

export function AttentionHeatmap({ tokens, attributions, width = 600, height = 200, title }: AttentionHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !tokens.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 20, bottom: 60, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(tokens.map((_, i) => i.toString()))
      .range([0, innerWidth])
      .padding(0.05);

    const colorScale = d3.scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateReds);

    g.selectAll('rect')
      .data(attributions)
      .enter()
      .append('rect')
      .attr('x', (_, i) => xScale(i.toString())!)
      .attr('y', (d) => innerHeight - (d.importance * innerHeight))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => d.importance * innerHeight)
      .attr('fill', (d) => colorScale(d.importance))
      .attr('rx', 2)
      .append('title')
      .text((d) => `Token: ${tokens[d.tokenIndex]?.text || ''}\nImportance: ${(d.importance * 100).toFixed(1)}%\nRisk: ${d.riskScore}%\n${d.explanation}`);

    g.selectAll('text.label')
      .data(tokens)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (_, i) => (xScale(i.toString()) || 0) + xScale.bandwidth() / 2)
      .attr('y', innerHeight + 12)
      .attr('text-anchor', 'end')
      .attr('transform', (_, i) => `rotate(-45, ${(xScale(i.toString()) || 0) + xScale.bandwidth() / 2}, ${innerHeight + 12})`)
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .text((d) => d.text);

    if (title) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e8e4dc')
        .attr('font-size', '13px')
        .text(title);
    }
  }, [tokens, attributions, width, height, title]);

  return (
    <div className="attention-heatmap">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }} />
    </div>
  );
}
