---
layout: project
title: Prompt Injection Visualizer
slug: prompt-injection-viz
status: active
description: "A browser-native educational platform that classifies, visualizes, and explains prompt injection attacks using Transformers.js, Tokenizers.js, and D3.js — all running locally via WebGPU."
tech:
  - React 19
  - TypeScript
  - Transformers.js
  - Tokenizers.js
  - ONNX Runtime Web
  - WebGPU
  - D3.js
  - Monaco Editor
  - TailwindCSS
  - Zustand
  - Framer Motion
links:
  - text: Launch App
    url: /xplorertech00.github.io/prompt-injection-viz/
  - text: Source
    url: https://github.com/Anandhasasidharan/xplorertech00.github.io/tree/main/prompt-injection-viz
demo_type: interactive
---

## Overview

Prompt Injection Visualizer is a production-quality browser application for understanding LLM prompt injection attacks through interactive visualization, explainability, and local AI inference. Everything runs client-side — no backend, no API keys, no cloud inference.

The application feels like Chrome DevTools for Prompt Injection.

## Features

- **Monaco Editor** — Syntax highlighting, inline decorations, hover cards, error markers
- **Real Tokenizer** — Tokenizers.js integration displaying token IDs, offsets, byte positions, special/subword tokens
- **Live Risk Classification** — Transformers.js models running via WebGPU, classifying 10 attack categories
- **Explainability** — Evidence highlighting, influential tokens, alternative predictions, reasoning summary
- **Token Attribution** — Per-token importance, risk score, category, and explanation on hover
- **Sentence Timeline** — Animated cumulative risk flow showing where attacks become dangerous
- **Attack Taxonomy** — OWASP-classified categories with descriptions, examples, and severity
- **Attack Chain** — D3 Sankey visualization of the attack flow from user prompt to potential impact
- **Instruction Hierarchy Simulator** — Conceptual simulation of System/Developer/User/Tools/Model conflicts
- **Defense Simulator** — 7 toggleable mitigations with real-time effectiveness breakdown
- **Safe Rewrite** — Generates safer alternatives with per-change explanations
- **Model Comparison** — Side-by-side metrics across browser-compatible models
- **Performance Dashboard** — WebGPU status, ONNX runtime, latency, tokens/sec, memory
- **Interpretability Dashboard** — Attention heatmap, confidence/uncertainty/entropy, alternative predictions
- **Report Export** — JSON and Markdown download

## Architecture

```
src/
├── ai/              # Tokenizer, Classifier, Embeddings, Inference, Model Registry
├── analysis/        # Attack Detection, Attribution, Confidence, Uncertainty
├── visualization/   # D3: Heatmaps, Force Graph, Tree, Sankey, Timeline
├── editor/          # Monaco Editor integration
├── components/      # 11 UI components
├── pages/           # Main page with tabbed interface
├── hooks/           # useTokenizer, useClassifier, useAnalysis
├── store/           # Zustand state management
└── types.ts         # All TypeScript interfaces
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| AI Inference | Transformers.js v4 + WebGPU |
| Tokenization | Tokenizers.js |
| Runtime | ONNX Runtime Web |
| Visualization | D3.js (Sankey, Force, Tree, Timeline, Heatmap) |
| Editor | Monaco Editor |
| Styling | TailwindCSS v4 + Framer Motion |
| State | Zustand |
| Icons | Lucide |

## Models

- **Classifier:** `Xenova/prompt-injection` (DistilBERT fine-tuned for injection detection)
- **Fallback:** `Xenova/toxic-bert` (BERT-based toxicity classifier)
- **Embeddings:** `Xenova/all-MiniLM-L6-v2` (384-dim sentence embeddings)
- **Tokenizer:** `bert-base-uncased` (loaded via Tokenizers.js from Hugging Face Hub)

All models run locally in-browser through ONNX Runtime Web.
