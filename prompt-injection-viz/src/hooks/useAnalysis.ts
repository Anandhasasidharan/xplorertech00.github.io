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
    setModelState({ loadingMessage: 'Initializing AI engine...' });
    try {
      const engine = await createEngine();
      engine.onProgress = (progress, message) => {
        setModelState({ loadingProgress: progress, loadingMessage: message });
      };
      await engine.initialize();
      const state = engine.getState();
      setModelState({
        classifierLoaded: state.classifierLoaded,
        embedderLoaded: state.embedderLoaded,
        tokenizerLoaded: state.tokenizerLoaded,
        device: state.device,
        loadingProgress: 100,
        loadingMessage: 'Ready',
      });
    } catch (e) {
      setModelState({ error: String(e), loadingMessage: 'Initialization failed, using fallback' });
    }
  }, [setModelState]);

  const runAnalysis = useCallback(async (defenseOverrides?: DefenseSettings) => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const activeDefenses = defenseOverrides || defenses;
      const result = await analyzePrompt(prompt, activeDefenses);
      setResult(result);
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [prompt, defenses, setIsAnalyzing, setResult]);

  return { runAnalysis, initialize, isAnalyzing };
}
