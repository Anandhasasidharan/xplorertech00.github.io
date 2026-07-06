import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { TokenInfo, TokenAttribution } from '../../types';

interface ForceGraphProps {
  tokens: TokenInfo[];
  attributions: TokenAttribution[];
  width?: number;
  height?: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  label: string;
  importance: number;
  riskScore: number;
  category: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number;
}

export function ForceGraph({ tokens, attributions, width = 500, height = 400 }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !tokens.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes: SimNode[] = tokens.map((t, i) => ({
      id: i,
      label: t.text,
      importance: attributions[i]?.importance || 0,
      riskScore: attributions[i]?.riskScore || 0,
      category: attributions[i]?.category || 'none',
    }));

    const links: SimLink[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({ source: i, target: i + 1, value: 1 });
    }

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).distance(40))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(15));

    const g = svg.append('g');

    const link = g.selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#2e303a')
      .attr('stroke-width', 1);

    const node = g.selectAll<SVGGElement, SimNode>('g.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);

    node.append('circle')
      .attr('r', (d) => 5 + d.importance * 10)
      .attr('fill', (d) => colorScale(d.importance))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .append('title')
      .text((d) => `${d.label}\nImportance: ${(d.importance * 100).toFixed(1)}%\nRisk: ${d.riskScore}%\nCategory: ${d.category}`);

    node.append('text')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .text((d) => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });
  }, [tokens, attributions, width, height]);

  return (
    <div className="force-graph">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block', background: 'transparent' }} />
    </div>
  );
}
