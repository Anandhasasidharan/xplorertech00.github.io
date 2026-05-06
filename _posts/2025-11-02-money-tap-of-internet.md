---
layout: post
title: "🚰 The Money Tap of the Internet: Who Really Owns the Web?"
date: 2025-11-02 00:00:00 +0530
categories: internet infrastructure
tags: [web, infrastructure, monopolies, net-neutrality, DNS]
slug: money-tap-of-internet
excerpt: "The internet feels decentralized. But follow the money — the DNS, the CDNs, the cloud providers, the undersea cables — and you'll find a handful of companies controlling the flow."
---

## The Illusion of Decentralization

We tell ourselves the internet is decentralized. No single point of failure. No central authority.

That's a comforting myth.

## The Layers of Control

### Layer 1: DNS (Who Names the Internet)

| Provider | Market Share |
|----------|-------------|
| Cloudflare (1.1.1.1) | ~15% of resolvers |
| Google (8.8.8.8) | ~10% of resolvers |
| AWS Route 53 | Dominant authoritative DNS |

Two companies see the DNS queries of roughly 25% of the internet. They know which sites you visit before you even load them.

### Layer 2: CDN (Who Delivers the Internet)

Cloudflare alone serves ~20% of all websites. One company. If Cloudflare has a configuration error (which has happened), 20% of the web is affected simultaneously.

### Layer 3: Cloud (Who Hosts the Internet)

| Provider | Market Share |
|----------|-------------|
| AWS | ~32% |
| Azure | ~23% |
| Google Cloud | ~11% |

Three companies host two-thirds of cloud workloads.

### Layer 4: Physical (Who Connects the Internet)

Undersea cables? Same companies. Google alone has invested in 33+ submarine cables. Meta has 15+. Amazon, Microsoft — they're all in the cable business now.

## The Single-Point-of-Failure Problem

When you stack these layers:

```
DNS → Google/Cloudflare
CDN → Cloudflare/Akamai  
Hosting → AWS/Azure/GCP
Physical → Same companies' cables
```

A motivated adversary (or a sufficiently bad outage) can take down massive swaths of the internet through just 2-3 companies.

## The Security Implications

For cybersecurity practitioners, this means:

1. **Supply chain risk** is concentrated — compromise one CDN, affect millions of sites
2. **Traffic analysis** is concentrated — a few companies see most of the internet's traffic patterns
3. **Threat intelligence** is asymmetric — the big players have data no one else can access

## What Can We Do?

Realistically? Not much at the infrastructure layer. But at the application layer:

- Self-host where possible (this blog is on GitHub Pages — which runs on... Fastly/Azure. See the problem?)
- Encrypt everything end-to-end (the big players can see metadata, not content)
- Decentralized alternatives (IPFS, ZeroNet, Freenet — limited adoption but exist)
- Support open infrastructure (Let's Encrypt, OpenStreetMap, community-run DNS)

## The Honest Take

The internet isn't owned by ISPs anymore. It's owned by the companies that resolve, deliver, and host the content. And that concentration is only increasing.

The "money tap" is real — and a few hands control it. My advice: understand the architecture, encrypt what you can, and build systems that don't trust the infrastructure.