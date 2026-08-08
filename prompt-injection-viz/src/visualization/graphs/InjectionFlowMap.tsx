import { useMemo, useState } from 'react';
import type { TokenInfo, FlagDetail } from '../../types';
import { buildFlowLayout, SEVERITY_COLORS } from './particleFlow/flowLayout';
import { WebGPUParticleFlow } from './particleFlow/WebGPUParticleFlow';
import { CanvasParticleFlow } from './particleFlow/CanvasParticleFlow';

interface InjectionFlowMapProps {
  tokens: TokenInfo[];
  flags: FlagDetail[];
  text: string;
  width?: number;
  height?: number;
}

function webgpuSupported(): boolean {
  try {
    return !!navigator.gpu;
  } catch {
    return false;
  }
}

function StaticFlowMap({ layout }: { layout: ReturnType<typeof buildFlowLayout> }) {
  if (!layout) return null;
  const { nodes, edges, width, height } = layout;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%' }}>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
          stroke={e.color}
          strokeWidth={Math.max(1, e.strength * 4)}
          opacity={0.35}
        />
      ))}
      {nodes.map(n => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <rect
            x={-18} y={-11} width={36} height={22} rx={11}
            fill={n.type === 'injection' ? n.color : '#1a1920'}
            stroke={n.type === 'injection' ? '#c4a35a' : '#2e303a'}
            strokeWidth={1.5}
          />
          <text
            textAnchor="middle" dy={4}
            fill={n.type === 'injection' ? '#000' : '#9ca3af'}
            fontSize="10" fontFamily="monospace"
            fontWeight={n.type === 'injection' ? 700 : 400}
          >
            {n.label.length > 8 ? n.label.slice(0, 6) + '…' : n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function InjectionFlowMap({ tokens, flags, text, width = 700, height = 400 }: InjectionFlowMapProps) {
  const [renderer, setRenderer] = useState<'webgpu' | 'canvas' | 'svg'>(
    () => (webgpuSupported() ? 'webgpu' : 'canvas'),
  );

  const layout = useMemo(
    () => buildFlowLayout(tokens, flags, text, width, height, 800),
    [tokens, flags, text, width, height],
  );

  if (!flags.length) {
    return (
      <div className="injection-flow-map bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <p className="text-[#6b685e] text-sm text-center py-8">No injection patterns detected — nothing to map.</p>
      </div>
    );
  }

  return (
    <div className="injection-flow-map bg-[#121216] border border-[#1a1920] rounded-lg p-4">
      {renderer === 'webgpu' && layout && (
        <WebGPUParticleFlow layout={layout} onError={() => setRenderer('canvas')} />
      )}
      {renderer === 'canvas' && layout && <CanvasParticleFlow layout={layout} />}
      {renderer === 'svg' && layout && <StaticFlowMap layout={layout} />}
      {!layout && (
        <p className="text-[#6b685e] text-sm text-center py-8">Could not map injection flow for this prompt.</p>
      )}
      <div className="mt-2 text-[10px] text-[#3d3b36] flex justify-end gap-3">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS.low }} /> low
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS.medium }} /> medium
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS.high }} /> high
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS.critical }} /> critical
        </span>
      </div>
    </div>
  );
}
