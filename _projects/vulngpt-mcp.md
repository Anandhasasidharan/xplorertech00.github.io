---
layout: project
title: VulnGPT MCP Server
slug: vulngpt-mcp
status: completed
description: "Vulnerability scanning with Model Context Protocol for Puch AI Hackathon."
tech:
  - Python
  - MCP
  - Vulnerability Scanning
  - Puch AI
  - Hackathon
links:
  - text: GitHub
    url: https://github.com/Anandhasasidharan/vulngpt-mcp-server
demo_type: interactive
---

## Overview

VulnGPT MCP Server was built for the Puch AI Hackathon. It implements the Model Context Protocol (MCP) to provide vulnerability scanning capabilities that any MCP-compatible client can use.

**What it does:**
- **MCP Integration** — Works with any MCP-compatible AI client (Claude, etc.)
- **Vulnerability Scanning** — Scans code, configurations, and dependencies for vulnerabilities
- **Context-Aware Analysis** — Uses LLM context to understand code intent and find deeper issues
- **Structured Output** — Returns findings in MCP-compatible format

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MCP Client     │────▶│  VulnGPT Server  │────▶│  Vulnerability  │
│  (Claude, etc.) │◀────│  (MCP Protocol)  │◀────│  Database       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Anandhasasidharan/vulngpt-mcp-server.git
cd vulngpt-mcp-server

# Install dependencies
pip install -r requirements.txt

# Run the MCP server
python server.py
```

## MCP Tools

The server exposes these tools via MCP:

- **`scan_code`** — Scan source code for vulnerabilities
- **`scan_dependencies`** — Check dependencies for known CVEs
- **`analyze_config`** — Analyze configuration files for misconfigurations
- **`get_report`** — Generate a vulnerability report

## Hackathon Context

Built during the Puch AI Hackathon to demonstrate how MCP can extend AI capabilities with security tools. The server acts as a bridge between AI assistants and vulnerability databases, enabling natural language security analysis.
