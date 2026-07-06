import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CategoryScore } from '../../types';

interface RiskHeatmapProps {
  categories: CategoryScore[];
  width?: number;
  height?: number;
}

export function RiskHeatmap({ categories, width = 500, height = 200 }: RiskHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 140 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = categories.length * 30;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand()
      .domain(categories.map(c => c.label))
      .range([0, innerHeight])
      .padding(0.3);

    const colorScale = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgbBasis(['#22c55e', '#eab308', '#ef4444']));

    g.selectAll('rect')
      .data(categories)
      .enter()
      .append('rect')
      .attr('y', (d) => yScale(d.label)!)
      .attr('width', (d) => (d.score / 100) * innerWidth)
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => colorScale(d.score))
      .attr('rx', 4)
      .append('title')
      .text((d) => `${d.label}: ${d.score}%\nConfidence: ${(d.confidence * 100).toFixed(1)}%\n${d.evidence.join('\n')}`);

    g.selectAll('text.label')
      .data(categories)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', -8)
      .attr('y', (d) => yScale(d.label)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#e8e4dc')
      .attr('font-size', '12px')
      .text((d) => d.label);

    g.selectAll('text.value')
      .data(categories)
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('x', (d) => (d.score / 100) * innerWidth + 8)
      .attr('y', (d) => yScale(d.label)! + yScale.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px')
      .text((d) => `${d.score}%`);
  }, [categories, width, height]);

  const totalHeight = Math.max(height, categories.length * 30 + 60);

  return (
    <div className="risk-heatmap">
      <svg ref={svgRef} width={width} height={totalHeight} style={{ display: 'block' }} />
    </div>
  );
}
