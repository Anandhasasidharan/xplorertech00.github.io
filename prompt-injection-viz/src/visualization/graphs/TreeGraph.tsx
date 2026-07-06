import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CategoryScore } from '../../types';

interface TreeNode {
  name: string;
  value: number;
  confidence?: number;
  children?: TreeNode[];
}

interface TreeGraphProps {
  categories: CategoryScore[];
  riskScore: number;
  width?: number;
  height?: number;
}

export function TreeGraph({ categories, riskScore, width = 400, height = 400 }: TreeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const data: TreeNode = {
      name: 'Prompt',
      value: riskScore,
      children: categories.map(c => ({
        name: c.label,
        value: c.score,
        confidence: c.confidence,
      })),
    };

    const g = svg.append('g').attr('transform', `translate(${width / 2},40)`);

    const treeLayout = d3.tree<TreeNode>().size([2 * Math.PI, Math.min(width / 2 - 40, height / 2 - 40)]);
    const root = d3.hierarchy(data);
    treeLayout(root);

    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis(['#22c55e', '#eab308', '#ef4444'])).domain([0, 100]);

    g.selectAll('line')
      .data(root.links())
      .enter()
      .append('line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
      .attr('stroke', '#2e303a')
      .attr('stroke-width', 1);

    const node = g.selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    node.append('circle')
      .attr('r', (d: any) => d.depth === 0 ? 12 : 6 + (d.data.value / 100) * 8)
      .attr('fill', (d: any) => d.depth === 0 ? '#c4a35a' : colorScale(d.data.value))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .append('title')
      .text((d: any) => `${d.data.name}: ${d.data.value}%${d.data.confidence ? `\nConfidence: ${(d.data.confidence * 100).toFixed(1)}%` : ''}`);

    node.filter((d: any) => d.depth > 0)
      .append('text')
      .attr('dx', (d: any) => d.x > width / 2 ? 14 : -14)
      .attr('dy', 4)
      .attr('text-anchor', (d: any) => d.x > width / 2 ? 'start' : 'end')
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .text((d: any) => d.data.name);

    node.filter((d: any) => d.depth === 0)
      .append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e8e4dc')
      .attr('font-size', '11px')
      .text('Prompt');
  }, [categories, riskScore, width, height]);

  return (
    <div className="tree-graph">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }} />
    </div>
  );
}
