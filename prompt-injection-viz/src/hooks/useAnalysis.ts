import { useCallback } from 'react';
import { useStore } from '../store';
import { analyzePrompt } from '../analysis';
import { createEngine } from '../ai/inference';
import type { DefenseSettings } from '../types';

export function useAnalysis() {
  const prompt = useStore((s) => s.prompt);
  const setResult = useStore((s) => s.setResult);
  const isAnalyzing = useStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useStore((s) => s.setIsAnalyzing);
  const defenses = useStore((s) => s.defenses);
  const setModelState = useStore((s) => s.setModelState);

  const initialize = useCallback(async () => {
    setModelState({ loadingMessage: 'Models loading (analysis works without them)', loadingProgress: 10 });
    try {
      const engine = await createEngine();
      engine.onProgress = (progress, message) => {
        setModelState({ loadingProgress: Math.min(progress, 90), loadingMessage: message });
      };
      await Promise.race([
        engine.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Model loading timed out')), 15000)),
      ]);
      const state = engine.getState();
      setModelState({
        classifierLoaded: state.classifierLoaded,
        embedderLoaded: state.embedderLoaded,
        tokenizerLoaded: state.tokenizerLoaded,
        device: state.device,
        loadingProgress: 100,
        loadingMessage: state.classifierLoaded ? 'Models ready' : 'Using regex fallback',
      });
    } catch (e) {
      setModelState({
        classifierLoaded: true,
        embedderLoaded: true,
        tokenizerLoaded: true,
        device: 'cpu',
        loadingProgress: 100,
        loadingMessage: 'Using regex fallback (models unavailable)',
        error: String(e),
      });
    }
  }, [setModelState]);

  const runAnalysis = useCallback(async (defenseOverrides?: DefenseSettings) => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const activeDefenses = defenseOverrides || defenses;
      const result = await Promise.race([
        analyzePrompt(prompt, activeDefenses),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Analysis timed out')), 30000)),
      ]);
      setResult(result);
    } catch (e) {
      console.error('Analysis error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [prompt, defenses, setIsAnalyzing, setResult]);

  return { runAnalysis, initialize, isAnalyzing };
}
