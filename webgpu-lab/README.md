# WebGPU Lab

Two small, self-contained browser demos that explain AI agent security to non-experts. Both are
plain HTML + CSS + JavaScript — no frameworks, no engines, no CDN scripts. Every page is a single
file with inline CSS and JS; the shared modules are inlined by a build step.

- **Live:** `/xplorertech00.github.io/webgpu-lab/`
- **Gatekeeper** — built from [SENTRIX](https://github.com/Anandhasasidharan/SENTRIX)
- **Delegation Tree** — built from [AgentIAM](https://github.com/Anandhasasidharan/AGENT-IAM)

---

## The demos

### 1. Gatekeeper (`gatekeeper/index.html`)

An AI agent issues tool calls. Before each one runs, a reference monitor checks it against a
deterministic capability policy.

| Decision | Shape | Behaviour |
|----------|-------|-----------|
| allowed | circle | passes the gate and continues right |
| flagged | diamond | slows down, changes shape and colour, keeps moving |
| blocked | square | breaks apart at the gate into fragments |

**Controls**

| Control | Effect |
|---------|--------|
| Play / Pause button, or `Space` | start / pause the simulation |
| Speed slider | 0.25x – 3x |
| Filter checkboxes | show only allowed / flagged / blocked calls |
| Restart | reset the session |
| Hover a particle | tooltip with tool, decision and reason |
| Click a particle | pin it in the side panel |
| `Tab` to the canvas, `←` / `→` | move between calls in flight, `Enter` pins one |
| The call list | every call as a button — the fully keyboard-navigable view |

Counters for each decision are shown in the toolbar, and a decision is always carried by **shape and
text** as well as colour.

### 2. Delegation Tree (`delegation-tree/index.html`)

A human operator delegates to a manager agent, the manager to a worker, the worker to tools. Each
agent's permission scope is drawn as a ring **inside** its parent's ring and shrinks at every hop.

- Click a node (or use the list / arrow keys) to select it. The panel shows its SPIFFE ID, who
  delegated to it, the narrowing diff, and its exact scopes.
- **Try to widen scope** — attempts to grant the child more than the parent holds. The attempt is
  rejected, the offending node flashes, and the message names the scope that was exceeded.
- **Try a valid narrowing** — a legitimate reduction of the parent's scope, which is issued.

---

## How it works

### Shared renderer (`shared/gpu.js`)

- **Feature detection** — `navigator.gpu`, adapter + device request.
- **Scene model** — a demo builds a flat array of primitives in pixel space:
  `{ x, y, w, h, rot, color, shape, extra }` with shapes `disc`, `square`, `ring`, `diamond`,
  `segment`.
- **GPU path** — one instanced-quad draw call. The vertex shader places and rotates each quad; the
  fragment shader evaluates a signed-distance function per shape (circle, box, ring, diamond,
  capsule). Uniforms carry the resolution and time; instance data carries position, size,
  rotation, colour, shape and shape parameters.
- **Fallback path** — the same primitive array is drawn with Canvas2D. Because both paths consume
  the same scene, the fallback is the same picture with less polish, never a blank page.
- **Loop** — `requestAnimationFrame` with delta time; `prefers-reduced-motion` starts the loop
  paused with a visible Play button.
- **Resize** — canvas backing store follows `devicePixelRatio` (capped at 2).

### Data and decision logic (`shared/data.js`)

Ported from the two source projects so the demos show real behaviour rather than scripted
animation:

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

### Rebuilding after editing a source file

```bash
node webgpu-lab/build.mjs
```

`build.mjs` inlines `shared/gpu.js` and `shared/data.js` into the templates in `src/` and writes the
self-contained pages to `webgpu-lab/`, `webgpu-lab/gatekeeper/` and `webgpu-lab/delegation-tree/`.
No dependencies — plain Node.

### Verifying

```bash
node webgpu-lab/verify.mjs        # needs playwright + a local server on :4000
```

`verify.mjs` loads every page in four modes — default, WebGPU forced off (Canvas2D fallback), a
390px mobile width, and `prefers-reduced-motion: reduce` — and fails on a non-200 response, any
console error, a shader compilation warning, a WebGPU validation error, an empty canvas, or an
interaction that does not behave (a widening attempt that is not rejected, a valid narrowing that is
not issued).

---

## Known limitations

- **Headless browsers do not composite a WebGPU canvas**, so a headless screenshot of the GPU path
  is blank. `verify.mjs` therefore renders the *same* scene into an offscreen texture and reads the
  pixels back, which proves the GPU path draws geometry. The screenshots in `docs/` marked
  `-fallback` are the Canvas2D renderer, and look equivalent apart from the shader effects.
- The Gatekeeper demo is a **visualisation of a decision pipeline**, not an execution harness: the
  calls do not run against a real agent or a real tool.
- The classifier port reproduces SENTRIX's **regex layer only**. SENTRIX also has a TF-IDF
  embedding stage; that is not implemented here, so the scores shown are the regex scores.
- The delegation demo uses the seeded demo chain from AgentIAM; it does not mint or verify real
  tokens, and the SPIFFE IDs are the demo domain `iam.local`.
- `prefers-reduced-motion` pauses the animation but the demos are still interactive.

---

## How it was made

<!-- TODO: fill this in yourself, honestly.

Suggested points to cover:
 - What drove the decision to build this (the internship application? explaining the projects?)
 - How long it took, and what you did yourself
 - What was genuinely hard (the SDF shader shapes? the WGSL uniform declaration bug? the nested-ring
   layout maths? the scope-narrowing rules?)
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
├── shared/
│   ├── gpu.js              # shared renderer: WebGPU + Canvas2D fallback
│   └── data.js             # ported policy / classifier / narrowing logic
├── src/                    # templates that the build step fills
│   ├── index.html
│   ├── gatekeeper.html
│   └── delegation-tree.html
├── build.mjs               # inlines shared/ into the templates -> built pages
├── verify.mjs              # headless checks (playwright)
├── docs/                   # screenshots from the verification run
└── README.md
```
