import { useStore } from '../store';
import { Cpu, Zap, Clock, Database, Hash, BarChart3, Wifi, HardDrive } from 'lucide-react';

export function PerformanceDashboard() {
  const result = useStore((s) => s.result);
  const modelState = useStore((s) => s.modelState);

  const metrics = [
    { label: 'Device', value: modelState.device.toUpperCase(), icon: Cpu },
    { label: 'Classifier', value: result?.modelInfo.classifier || 'N/A', icon: Database },
    { label: 'Tokenizer', value: result?.modelInfo.tokenizer || 'N/A', icon: Hash },
    { label: 'Total Latency', value: result ? `${result.metrics.totalMs}ms` : '—', icon: Clock },
    { label: 'Classification', value: result ? `${result.metrics.classificationMs}ms` : '—', icon: Zap },
    { label: 'Tokenization', value: result ? `${result.metrics.tokenizationMs}ms` : '—', icon: Clock },
    { label: 'Tokens/sec', value: result ? `${result.metrics.tokensPerSecond}` : '—', icon: BarChart3 },
    { label: 'Token Count', value: result ? `${result.tokens.length}` : '—', icon: Hash },
    { label: 'GPU Available', value: (typeof navigator !== 'undefined' && 'gpu' in navigator) ? 'Yes' : 'No', icon: Cpu },
    { label: 'Model Status', value: modelState.classifierLoaded ? 'Loaded' : 'Loading...', icon: Wifi },
    { label: 'Cache', value: 'Browser Cache', icon: HardDrive },
  ];

  return (
    <div className="performance-dashboard">
      <div className="bg-[#121216] border border-[#1a1920] rounded-lg p-4">
        <h3 className="text-[#e8e4dc] font-serif text-sm mb-3">Performance Dashboard</h3>
        <p className="text-[#6b685e] text-xs mb-4">
          Model loading status, inference metrics, and hardware capabilities.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className="p-3 bg-[#0f0f14] rounded border border-[#1a1920]">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className="text-[#6b685e]" />
                  <span className="text-[10px] text-[#6b685e] uppercase tracking-wider">{m.label}</span>
                </div>
                <span className="text-sm text-[#e8e4dc] font-mono">{m.value}</span>
              </div>
            );
          })}
        </div>

        {modelState.loadingProgress < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
              <span>{modelState.loadingMessage}</span>
              <span>{modelState.loadingProgress}%</span>
            </div>
            <div className="h-2 bg-[#1a1920] rounded-full overflow-hidden">
              <div className="h-full bg-[#c4a35a] rounded-full transition-all duration-300"
                style={{ width: `${modelState.loadingProgress}%` }} />
            </div>
          </div>
        )}

        {modelState.error && (
          <div className="mt-3 p-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded text-xs text-[#ef4444]">
            {modelState.error}
          </div>
        )}
      </div>
    </div>
  );
}
