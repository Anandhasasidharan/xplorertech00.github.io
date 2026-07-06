import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/xplorertech00.github.io/prompt-injection-viz/',
  build: {
    outDir: '../prompt-injection-viz-build',
    emptyOutDir: true,
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@huggingface/tokenizers'],
  },
  worker: {
    format: 'es',
  },
})
