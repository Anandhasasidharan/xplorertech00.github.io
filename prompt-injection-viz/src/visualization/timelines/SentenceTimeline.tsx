import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SentenceResult } from '../../types';

interface SentenceTimelineProps {
  sentences: SentenceResult[];
  width?: number;
  height?: number;
}

export function SentenceTimeline({ sentences, width = 500, height: containerHeight }: SentenceTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !sentences.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const height = Math.max(containerHeight || 200, sentences.length * 40 + margin.top + margin.bottom);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(sentences.map((_, i) => i.toString()))
      .range([0, innerHeight])
      .padding(0.4);

    const colorScale = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgbBasis(['#22c55e', '#eab308', '#ef4444']));

    sentences.forEach((s, i) => {
      const y = yScale(i.toString())! + yScale.bandwidth() / 2;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', xScale(s.risk))
        .attr('y2', y)
        .attr('stroke', colorScale(s.risk))
        .attr('stroke-width', yScale.bandwidth() * 0.6)
        .attr('stroke-linecap', 'round')
        .append('title')
        .text(`Sentence ${i + 1}: ${s.text}\nRisk: ${s.risk}%\nFlags: ${s.flags.length}`);

      g.append('circle')
        .attr('cx', xScale(s.risk))
        .attr('cy', y)
        .attr('r', 4 + (s.risk / 100) * 4)
        .attr('fill', colorScale(s.risk))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);

      g.append('text')
        .attr('x', -8)
        .attr('y', y)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#9ca3af')
        .attr('font-size', '10px')
        .text(`${i + 1}`);

      g.append('text')
        .attr('x', innerWidth + 8)
        .attr('y', y)
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#9ca3af')
        .attr('font-size', '9px')
        .attr('max-width', '150px')
        .text(s.text.length > 30 ? s.text.slice(0, 30) + '...' : s.text);
    });

    if (sentences.length > 1) {
      const cumulative = sentences.reduce((acc: number[], s) => {
        const last = acc.length > 0 ? acc[acc.length - 1] : 0;
        acc.push(last + s.risk);
        return acc;
      }, []);

      const maxCumulative = Math.max(...cumulative, 1);
      const line = d3.line<number>()
        .x((_, i) => xScale((cumulative[i] / maxCumulative) * 100))
        .y((_, i) => yScale(i.toString())! + yScale.bandwidth() / 2);

      g.append('path')
        .datum(d3.range(cumulative.length))
        .attr('d', line as any)
        .attr('fill', 'none')
        .attr('stroke', '#c4a35a')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.5);
    }

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b685e')
      .attr('font-size', '10px')
      .text('Risk Score →');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e8e4dc')
      .attr('font-size', '12px')
      .text('Sentence-by-Sentence Risk Timeline');
  }, [sentences, width, containerHeight]);

  const height = Math.max(containerHeight || 200, sentences.length * 40 + 60);

  return (
    <div className="sentence-timeline">
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }} />
    </div>
  );
}
