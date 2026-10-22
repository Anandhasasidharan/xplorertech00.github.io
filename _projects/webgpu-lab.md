---
layout: project
title: Three.js Lab
slug: webgpu-lab
status: active
description: "Two self-contained Three.js demos that explain AI agent security to non-experts: a reference monitor that allows, flags or blocks tool calls, and a delegation tree where authority can only narrow."
tech:
  - Three.js
  - WebGPU
  - WebGL 2
  - Vanilla JavaScript
  - esbuild
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

The Three.js Lab is a pair of small browser demos that make two ideas from my own security projects
visible to someone who does not work with agents.

**Gatekeeper** (from [SENTRIX](https://github.com/Anandhasasidharan/SENTRIX)) shows an agent's tool
calls streaming along lanes into a reference monitor. Each call is allowed, flagged or blocked:
allowed calls pass with a flash, flagged calls slow down and change shape, and blocked calls break
apart at the gate. The decisions are not scripted: the demo ports SENTRIX's capability policy
(`AgentPolicy.check_tool`) and its injection-classifier patterns, so every verdict and reason string
is computed in the browser.

**Delegation Tree** (from [AgentIAM](https://github.com/Anandhasasidharan/AGENT-IAM)) draws each
agent's permission scope as a glowing shell nested inside its parent's, contracting at every hop.
Pressing "Try to widen scope" sends a token to the parent boundary, where it is refused with the exact
scope that was exceeded, using the project's real narrowing rules and rejection message.

**What it demonstrates**

- One shared Three.js scene layer (`shared/scene.js`): a `WebGPURenderer` that uses WebGPU where the
  browser has it and WebGL 2 otherwise, soft bloom on bright elements only, DOM labels with leader
  lines, and guarded instanced particles.
- Decisions and hierarchy carried by shape and text, never by colour alone.
- Keyboard access, visible focus, and a reduced-motion mode that starts paused.

**Why it exists**

Security ideas are easy to describe and hard to picture. These demos are an attempt to show the
mechanism rather than the slogan: where an agent's authority comes from, and why "narrow, never
expand" is a property you can *see*.
