---
layout: project
title: WebGPU Lab
slug: webgpu-lab
status: active
description: "Two self-contained WebGPU demos that explain AI agent security to non-experts: a reference monitor that allows, flags or blocks tool calls, and a delegation tree where authority can only narrow."
tech:
  - WebGPU
  - WGSL
  - Canvas2D fallback
  - Vanilla JavaScript
  - HTML
links:
  - text: Open the lab
    url: /xplorertech00.github.io/webgpu-lab/
  - text: Gatekeeper demo
    url: /xplorertech00.github.io/webgpu-lab/gatekeeper/
  - text: Delegation Tree demo
    url: /xplorertech00.github.io/webgpu-lab/delegation-tree/
demo_type: interactive
---

## Overview

The WebGPU Lab is a pair of small, dependency-free browser demos that make two ideas from my own
security projects visible to someone who does not work with agents.

**Gatekeeper** (from [SENTRIX](https://github.com/Anandhasasidharan/SENTRIX)) shows an agent's tool
calls travelling toward a reference monitor. Each call is allowed, flagged or blocked, and blocked
calls visibly break apart at the gate. The decisions are not scripted: the demo ports SENTRIX's
capability policy (`AgentPolicy.check_tool`) and its injection-classifier patterns, so every verdict
and reason string is computed in the browser.

**Delegation Tree** (from [AgentIAM](https://github.com/Anandhasasidharan/AGENT-IAM)) draws each
agent's permission scope inside its parent's scope, shrinking at every hop. Pressing "Try to widen
scope" attempts to grant a child more than the parent holds; the attempt is rejected with the exact
scope that was exceeded, using the project's real narrowing rules and rejection message.

**What it demonstrates**

- A shared renderer (`shared/gpu.js`) that draws an entire scene as instanced quads with an SDF
  fragment shader, and falls back to Canvas2D when WebGPU is unavailable — the same scene, the same
  data, so the idea stays visible on any browser.
- Decisions carried by shape and text, never by colour alone.
- Keyboard access, visible focus, and a reduced-motion mode that starts paused.

**Why it exists**

Security ideas are easy to describe and hard to picture. These demos are an attempt to show the
mechanism rather than the slogan: where an agent's authority comes from, and why "narrow, never
expand" is a property you can *see*.
