---
layout: project
title: ORYTH
slug: oryth
status: active
description: "Email security dashboard powered by CENSYS — monitor, analyze, and defend your email infrastructure."
tech:
  - Python
  - CENSYS
  - Email Security
  - Dashboard
  - Threat Intelligence
links:
  - text: GitHub
    url: https://github.com/Anandhasasidharan/ORYTH
demo_type: interactive
---

## Overview

ORYTH is an email security dashboard that uses CENSYS to monitor, analyze, and defend your email infrastructure. It provides real-time visibility into your email attack surface, detecting misconfigurations, spoofing vulnerabilities, and potential breaches.

**What it does:**
- **Infrastructure Scanning** — Discovers email-related assets using CENSYS APIs
- **SPF/DKIM/DMARC Analysis** — Validates email authentication configurations
- **Spoofing Detection** — Identifies domains vulnerable to email spoofing
- **Threat Intelligence** — Correlates findings with known threat indicators
- **Real-time Dashboard** — Visualizes your email security posture

## Architecture

```
┌─────────────────────────────────────┐
│            ORYTH Dashboard          │
├──────────────┬──────────────────────┤
│  CENSYS API  │  Analysis Engine     │
│  - IP Scan   │  - SPF Validation   │
│  - DNS Lookup│  - DKIM Check       │
│  - Port Scan │  - DMARC Verify     │
│              │  - Spoofing Test    │
├──────────────┴──────────────────────┤
│         Visualization Layer         │
│  - Real-time Dashboard              │
│  - Alert System                     │
│  - Report Generation                │
└─────────────────────────────────────┘
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Anandhasasidharan/ORYTH.git
cd ORYTH

# Install dependencies
pip install -r requirements.txt

# Configure CENSYS credentials
export CENSYS_API_ID="your_api_id"
export CENSYS_API_SECRET="your_api_secret"

# Run the dashboard
python oryth.py --port 8080
```

## Features

- **Domain Discovery** — Find all email-related infrastructure for a domain
- **Configuration Audit** — Check SPF, DKIM, and DMARC records
- **Vulnerability Detection** — Identify misconfigurations that enable spoofing
- **Historical Tracking** — Monitor changes in your email security posture
- **Alert System** — Get notified of critical findings
