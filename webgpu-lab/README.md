# Three.js Lab

Two small, self-contained browser demos that explain AI agent security to non-experts. Both are
Three.js scenes written in vanilla JavaScript — no frameworks. Every page is a single file with
inline CSS and JavaScript: the Three.js modules are bundled with esbuild, tree-shaken, and inlined by
the build step, so nothing is fetched at runtime.

- **Live:** `/xplorertech00.github.io/webgpu-lab/`
- **Gatekeeper** — built from [SENTRIX](https://github.com/Anandhasasidharan/SENTRIX)
- **Delegation Tree** — built from [AgentIAM](https://github.com/Anandhasasidharan/AGENT-IAM)

The folder and the URLs keep the `webgpu-lab` name; only the display name changed.

---

## The demos

### 1. Gatekeeper (`gatekeeper/index.html`)

An AI agent issues tool calls. Before each one runs, a reference monitor checks it against a
deterministic capability policy. Calls stream along lanes into a ring-shaped gate.

| Decision | Shape after the gate | Behaviour |
|----------|----------------------|-----------|
| allowed | sphere, green | passes with a brief flash and keeps moving |
| flagged | octahedron, amber | slows down, changes shape and colour, keeps moving |
| blocked | fragments, red | breaks apart on the gate; the rim pulses red |

Red appears only for a block or a rejection.

**Controls**

| Control | Effect |
|---------|--------|
| Play / Pause button, or `Space` | start / pause the simulation |
| Speed slider | 0.25x – 3x |
| Filter checkboxes | show only allowed / flagged / blocked calls |
| Restart | reset the session |
| Quality | High (bloom + trails) or Low |
| Reset view | recentre the camera |
| Drag / scroll / pinch | orbit and zoom |
| Hover a particle | tooltip with tool, decision and reason |
| Click a particle | pin it in the side panel |
| The call list | every call as a button — the fully keyboard-navigable view |
| `F` | fps and active backend (WebGPU or WebGL 2) |

Counters for each decision are shown in the toolbar, and a decision is always carried by **shape and
text** as well as colour.

### 2. Delegation Tree (`delegation-tree/index.html`)

A human operator delegates to a manager agent, the manager to a worker, the worker to tools. Each
agent's permission scope is a translucent glowing shell **nested inside** its parent's, so the
narrowing rule is visible as physical containment.

- Each hop has its own colour (warm gold → amber → teal → cool blue) and its own marker shape
  (cube = human, octahedron = agent, sphere = tool; the temporary tool gets a dashed ring).
- A capability token travels from Alice down each delegation path with a short glowing trail. When it
  enters a child shell, that shell contracts smoothly and one chip shows the real diff
  (`resources 2 -> 1, operations 2 -> 1`), read live from the data.
- Click a node, use the list, or use the arrow keys to select it. The selected node and its ancestors
  glow while unrelated nodes dim; hovering brightens a shell and shows a tooltip. The panel shows the
  SPIFFE ID, who delegated to it, the narrowing diff, and its exact scopes.
- **Try to widen scope** — the token stops at the parent boundary, the offending shell flashes, a red
  shockwave ring expands and fades in under a second, and the message names the scope that was
  exceeded.
- **Try a valid narrowing** — the token passes, the shell contracts, and a new marker pops in.
- Controls: Play/Pause (also `Space`), a speed slider, **Replay delegation**, Quality, Reset view.
  Drag to orbit, scroll or pinch to zoom, `F` for fps and backend.

The colour and motion decisions are recorded in [`docs/design-notes.md`](docs/design-notes.md).

---

## How it works

### Shared scene layer (`shared/scene.js`)

- **Renderer** — `WebGPURenderer` from `three/webgpu`. It uses WebGPU where the browser has it and
  falls back to the WebGL 2 backend automatically; `?backend=webgl` forces WebGL 2. Initialisation is
  asynchronous (`await renderer.init()`), and the output colour space is set explicitly to sRGB.
- **Post-processing** — `RenderPipeline` + `bloom()` from `three/addons/tsl/display/BloomNode.js`,
  with a luminance threshold so only bright elements (tokens, particles, rims) bloom. Low quality
  renders the scene pass directly, which turns bloom and trails off.
- **Camera** — one perspective camera on a spherical rig: damped drag to orbit with angle limits,
  wheel and pinch zoom with distance limits, a few degrees of pointer parallax, and a Reset view
  button that eases back to the opening shot.
- **Labels** — real DOM text over the canvas, positioned from projected 3D anchors, with SVG leader
  lines, collision avoidance and clamping inside the canvas.
- **Dust** — a faint additive point field for depth; it does not drift under reduced motion.
- **Particles** — instanced meshes with fixed capacities and reused buffers. Positions, scales and
  colours are written into preallocated arrays each frame; nothing is allocated in the frame loop.
- **Performance** — device pixel ratio capped at 2; if the average frame time stays above ~20 ms for
  two seconds the lab drops to Low quality and says so.
- **Reduced motion** — `prefers-reduced-motion: reduce` starts paused with a visible Play button, no
  parallax, no drift and no pulsing.
- **No GPU** — if neither WebGPU nor WebGL 2 is available, the page shows a short message and a still
  screenshot of the demo instead of a blank canvas.

### Data and decision logic (`shared/data.js`)

Untouched by the Three.js rebuild. Ported from the two source projects so the demos show real
behaviour rather than scripted animation:

| From | What was ported |
|------|-----------------|
| SENTRIX `src/sentrix/models/policy.py` | `AgentPolicy.check_tool` — allow/block lists, default deny, reason strings |
| SENTRIX `src/sentrix/classifier/detector.py` | the injection / memory-poisoning / tool-anomaly regex patterns, severity weights and `score_text` |
| SENTRIX `src/sentrix/harness/obfuscator.py` | the `STANDARD_ATTACKS` payload wording |
| SENTRIX `examples/demo.py` | the capability policy used by the demo and the scenario labels |
| AgentIAM `scripts/seed_demo.py` | the delegation chain, SPIFFE IDs, scopes, and the recorded rejection |
| AgentIAM `agentiam/tokens/scope_utils.py` | `is_valid_attenuation` — path narrowing and operation subset rules |
| AgentIAM `agentiam/tokens/attenuate.py` | the exact rejection message |
| AgentIAM `agentiam/dashboard/diff.py` | `caveat_diff` — the "resources 2 -> 1, operations 2 -> 1" summaries |

**Illustrative sample data.** The tool calls, their arguments and the payload wording come from
those repositories. The *order* in which calls arrive, the lane assignment and the short
per-call annotations were composed for this demo — the interfaces label them as such. No secrets,
API keys, tokens, real email addresses or live scan results are included.

---

## Running it

The built pages are static files — any static server works:

```bash
# from the repository root, serving the site the way Jekyll would
python3 -m http.server 4000 --bind 127.0.0.1
# then open:
# http://127.0.0.1:4000/xplorertech00.github.io/webgpu-lab/

# or the Jekyll way (needs Ruby + bundler)
bundle exec jekyll serve
# http://127.0.0.1:4000/xplorertech00.github.io/webgpu-lab/
```

Query parameters, for testing: `?backend=webgl` forces the WebGL 2 backend, `?quality=low` or
`?quality=high` pins the quality level (which also disables the automatic drop), and `?colortest=1`
draws palette swatches for the pixel-sampling check.

### Building

```bash
cd webgpu-lab
npm install          # once
npm run build        # or: node webgpu-lab/build.mjs from the repo root
```

Dependencies are pinned exactly: **three 0.186.1**, esbuild 0.25.10, acorn 8.19.0 (build-time only).
`build.mjs` bundles `src/gatekeeper.js` and `src/delegation-tree.js` with esbuild
(`--bundle --format=iife --minify`), inlines the result into the templates in `src/`, and writes the
self-contained pages to `webgpu-lab/`, `webgpu-lab/gatekeeper/` and `webgpu-lab/delegation-tree/`.
Tree-shaking keeps only the Three.js modules the demos import. The build refuses to finish if a
built page contains the sequences `{{`, `}}`, `{%` or `%}` — minified bundles are full of `}}`, so
`tools/liquid-safe.mjs` neutralises them (a space between code braces, an escape inside string and
regex literals) without changing behaviour. It is never necessary to hand-edit a built page.

### Verifying

```bash
node webgpu-lab/verify.mjs        # needs playwright + a local server on :4000
```

`verify.mjs` loads both demos with the default backend and with `?backend=webgl`, in four modes —
default, 390px width, `prefers-reduced-motion: reduce`, and Low quality — and fails on a non-200
response, any console error, a missing canvas, or a demo that does not expose its backend. It also
samples palette colours from a screenshot and reports the demo sizes.

---

## Known limitations

- **Headless browsers do not composite a WebGPU canvas into a screenshot**, so a normal headless
  screenshot of the WebGPU path is blank even when the demo renders. Screenshots in `docs/` are taken
  with `?backend=webgl` (labelled in each file name), and the WebGPU path is checked by loading it
  headlessly and asserting the backend reports `WebGPU` with no console errors. Real on-screen WebGPU
  output on hardware was not visually verified.
- The Gatekeeper demo is a **visualisation of a decision pipeline**, not an execution harness: the
  calls do not run against a real agent or a real tool.
- The classifier port reproduces SENTRIX's **regex layer only**. SENTRIX also has an embedding
  classifier; that is not implemented here, so the scores shown are the regex scores.
- The delegation demo uses the seeded demo chain from AgentIAM; it does not mint or verify real
  tokens, and the SPIFFE IDs are the demo domain `iam.local`.
- `prefers-reduced-motion` pauses the animation but the demos are still interactive.

---

## How it was made

The lab was first built with a hand-written WebGPU renderer and then rebuilt on Three.js.

> **TODO — to be written by me.** The guiding questions are in the HTML comment below; the section
> stays a placeholder until I write it.

<!-- TODO: fill this in yourself, honestly.

Suggested points to cover:
 - What drove the decision to build this (the internship application? explaining the projects?)
 - How long it took, and what you did yourself
 - What was genuinely hard (the nested-shell layout maths? the scope-narrowing rules? the rejection
   timing?)
 - What you would do differently next time
 - Anything a reviewer should look at first in the code
-->

_To be written._

---

## Files

```
webgpu-lab/
├── index.html              # landing page (built)
├── gatekeeper/index.html   # Gatekeeper demo (built, self-contained)
├── delegation-tree/index.html
├── package.json            # pinned three + esbuild + acorn
├── shared/
│   ├── scene.js            # renderer, camera, bloom, labels, particles, HUD
│   └── data.js             # ported policy / classifier / narrowing logic
├── src/                    # templates + demo sources
│   ├── index.html
│   ├── gatekeeper.html
│   ├── gatekeeper.js
│   ├── delegation-tree.html
│   └── delegation-tree.js
├── tools/
│   └── liquid-safe.mjs     # makes the minified bundle Liquid-safe
├── build.mjs               # bundles and inlines -> built pages
├── verify.mjs              # headless checks (playwright)
├── docs/                   # screenshots and design notes
└── README.md
```
