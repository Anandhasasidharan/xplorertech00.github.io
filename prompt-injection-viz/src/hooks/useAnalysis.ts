import { useCallback } from 'react';
import { useStore } from '../store';
import { analyzePrompt } from '../analysis';
import { createEngine } from '../ai/inference';
import type { DefenseSettings } from '../types';

let initStarted = false;

export function useAnalysis() {
  const prompt = useStore((s) => s.prompt);
  const setResult = useStore((s) => s.setResult);
  const isAnalyzing = useStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useStore((s) => s.setIsAnalyzing);
  const defenses = useStore((s) => s.defenses);
  const setModelState = useStore((s) => s.setModelState);

  const initialize = useCallback(async () => {
    if (initStarted) return;
    initStarted = true;

    setModelState({
      classifierLoaded: true,
      embedderLoaded: true,
      tokenizerLoaded: true,
      device: 'cpu',
      loadingProgress: 100,
      loadingMessage: 'Models loading in background (analysis works without them)',
    });

    // Fire-and-forget: AI models load in background, never block the UI
    createEngine().then(engine => {
      engine.onProgress = (progress, message) => {
        setModelState({ loadingProgress: Math.min(progress, 90), loadingMessage: message });
      };
      return Promise.race([
        engine.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Model loading timed out')), 15000)),
      ]);
    }).then(() => {
      const state = useStore.getState().modelState;
      setModelState({
        ...state,
        loadingProgress: 100,
        loadingMessage: 'AI models ready (enhancing analysis)',
        classifierLoaded: true,
      });
    }).catch(() => {
      setModelState({
        classifierLoaded: true,
        embedderLoaded: true,
        tokenizerLoaded: true,
        device: 'cpu',
        loadingProgress: 100,
        loadingMessage: 'Using regex fallback (models unavailable)',
      });
    });
  }, [setModelState]);

  const runAnalysis = useCallback(async (defenseOverrides?: DefenseSettings) => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const activeDefenses = defenseOverrides || defenses;
      const result = await Promise.race([
        analyzePrompt(prompt, activeDefenses),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Analysis timed out')), 10000)),
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