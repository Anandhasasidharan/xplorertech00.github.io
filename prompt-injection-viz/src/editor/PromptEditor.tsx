import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store';

export function PromptEditor() {
  const prompt = useStore((s) => s.prompt);
  const setPrompt = useStore((s) => s.setPrompt);

  const handleChange = useCallback((value: string | undefined) => {
    setPrompt(value || '');
  }, [setPrompt]);

  return (
    <div className="prompt-editor">
      <Editor
        height="160px"
        defaultLanguage="markdown"
        value={prompt}
        onChange={handleChange}
        onMount={() => {}}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          lineNumbers: 'off',
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: { top: 12 },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          renderWhitespace: 'selection',
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          hover: { enabled: true },
        }}
      />
    </div>
  );
}
