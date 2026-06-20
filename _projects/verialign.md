---
layout: project
title: VeriAlign
slug: verialign
status: active
description: "A reverse proxy that intercepts LLM API calls and augments responses with verification metadata."
tech:
  - Python
  - Reverse Proxy
  - LLM APIs
  - Claim Extraction
  - Source Grounding
  - Contradiction Detection
links:
  - text: GitHub
    url: https://github.com/Anandhasasidharan/verialign
demo_type: interactive
---

## Overview

VeriAlign sits between any application and any OpenAI-compatible provider, intercepting LLM API calls and augmenting responses with verification metadata. Every claim the model makes gets traced, grounded, and scored.

**What it does:**
- **Claim Extraction** — Parses model output into discrete, testable claims
- **Source Grounding** — Maps each claim to supporting evidence or flags unsupported assertions
- **Contradiction Detection** — Identifies internal inconsistencies within a single response
- **Confidence Scoring** — Assigns reliability scores to each claim based on grounding evidence
- **Checklist Verification** — Validates responses against predefined compliance checklists

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Your App   │────▶│  VeriAlign   │────▶│  LLM Provider   │
│             │◀────│  (Proxy)     │◀────│  (OpenAI, etc.) │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Verified   │
                    │  Response   │
                    │  + Metadata │
                    └─────────────┘
```

## Architecture

The proxy intercepts HTTP requests to any OpenAI-compatible endpoint, forwards them to the actual provider, then post-processes the response:

1. **Intercept** — Catches the streaming or non-streaming response
2. **Extract** — Parses claims from the model output using NLP pipelines
3. **Ground** — Cross-references claims against provided context or knowledge base
4. **Score** — Computes confidence based on grounding strength and contradiction analysis
5. **Augment** — Attaches verification metadata to the response before returning it

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Anandhasasidharan/verialign.git
cd verialign

# Install dependencies
pip install -r requirements.txt

# Run the proxy
python -m verialign --port 8080 --upstream https://api.openai.com
```

## Use Cases

- **AI Safety** — Verify model outputs before acting on them
- **Compliance** — Ensure responses meet regulatory checklists
- **Red Teaming** — Detect contradictions and unsupported claims in adversarial contexts
- **Blue Team Ops** — Ground security recommendations in real evidence
