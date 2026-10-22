# Design notes — Delegation Tree (WebGPU Lab)

Written after querying the `ui-ux-pro-max` skill in `.opencode/skills/ui-ux-pro-max/`:

```bash
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "data visualisation nested hierarchy flow diagram dark" --domain chart -n 4
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "dark mode dashboard warm gold accent restrained" --domain color -n 3
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "motion animation micro-interaction duration easing feedback" --domain ux -n 5
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "accessibility contrast ratio focus visible keyboard navigation reduced motion" --domain ux -n 6
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "dark minimal editorial restrained motion" --domain style -n 3
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "security dashboard dark editorial serif gold" --design-system -p "Delegation Tree"
```

## What the skill suggested, and what was taken from it

**Taken — chart type.** The skill's `chart` domain returns *Decomposition Tree* for root-cause /
tree / hierarchy data ("clear hierarchy, allow keyboard navigation for nodes") and *Sankey* for
flow data. The decomposition tree is the right model here: the subject is a hierarchy where each
level is a subset of the one above. Sankey was **rejected** — it fits flow *between* stages rather
than containment, and the skill itself flags Sankey as "⚠ Poor" for accessibility because it needs a
flow-table alternative. The demo already has that alternative: the side panel lists every scope as
text, and the "Delegation chain" list is a keyboard-navigable table of the same data.

**Taken — hierarchy colour rule.** "Parent: distinct hues, children: lighter shades." Applied as a
single warm-to-cool ramp along the chain rather than random hues per node, so depth in the tree is
readable at a glance.

**Taken — motion rules.**
- *Easing*: "Use ease-out for entering, ease-in for exiting" — scope contraction eases out, the
  shockwave fades out.
- *Duration*: "150–300ms for micro-interactions", "Don't use animations longer than 500ms for UI" —
  hover brightening 200ms, chip fade 250ms, label transitions 200ms; the rejection shockwave is
  under one second (≈600ms) and the scope contraction 600ms.
- *Restraint*: "Animate 1–2 key elements per view maximum" — only the token flow and the scope it
  enters move. Everything else is still unless hovered or selected.
- *Reduced motion*: "Check prefers-reduced-motion media query" (severity: High) — the demo starts
  paused with a visible Play button, and no particles travel until Play is pressed.

**Taken — accessibility rules.**
- *Focus states*: "Use visible focus rings on interactive elements" (severity: High) — 2px gold
  `outline` with offset on the canvas, buttons, links, and the range input.
- *Keyboard navigation*: "All functionality accessible via keyboard", "Tab order matches visual
  order" (severity: High) — arrow keys move the selection between agents, Tab reaches the node
  list, the speed slider and the three action buttons, in visual order.
- *Colour contrast*: "Minimum 4.5:1 ratio for normal text" (severity: High) — body text
  `#B9B6AD` on `#07080C` (≈9:1), dim text `#7A7780` (≈4.6:1) is used only for secondary metadata,
  and every colour-coded element also carries a shape and a text label.

**Taken — style.** The skill's *Dark Mode (OLED)* entry: "Minimal glow (text-shadow: 0 0 10px)",
"dark-to-light transitions", "visible focus" — used for the selected node's soft halo and the label
text shadow. Its *Exaggerated Minimalism* entry (oversized type, single accent, maximum whitespace)
was **rejected**: the host site is an editorial serif layout and a display-face headline would fight
it.

**Rejected — glassmorphism, neumorphism, heavy gradients.** The skill's palette search returns
"Premium dark + gold accent" (e-commerce luxury) and the style list contains Neumorphism and
Glassmorphism. Both conflict with the brief: the delegation tree must stay quiet so the token is the
only bold thing, glass and embossed surfaces would flatten the nesting into decorative panels, and
multi-stop gradients would fight the single warm-gold accent.

## Palette (named hex values)

| Role | Name | Hex | Used for |
|------|------|-----|----------|
| Root scope / accent | Site gold | `#D8B56C` | Alice's scope rim, token particles, edges, selected label |
| Root scope (bright rim) | Pale gold | `#E8C88C` | Alice's marker, rim highlight |
| Depth 1 | Amber | `#E29E4A` | Manager Agent scope |
| Depth 1 (bright rim) | Light amber | `#F0BA6E` | Manager marker |
| Depth 2 | Teal | `#42A69C` | Worker Agent scope |
| Depth 2 (bright rim) | Light teal | `#68C4BA` | Worker marker |
| Depth 3 | Cool blue | `#5285C7` | Tool scopes |
| Depth 3 (bright rim) | Light blue | `#7CACE8` | Tool markers |
| Neutral | Warm grey | `#969288` | Unrelated/structural marks |
| Rejection | Signal red | `#FF5968` | Shockwave, offending-scope flash, rejection chip |
| Acceptance | Signal green | `#39FF88` | Issued chip border in the side panel |
| Background | Ink | `#07080C` | Page |
| Surface | Panel | `#0C1017` | Panels |
| Text primary | Bone | `#F2EFE9` | Headings, node labels |
| Text secondary | Ash | `#B9B6AD` | Body copy, scope values |
| Text dim | Slate | `#7A7780` | Secondary metadata only |

The ramp is warm → cool down the chain, so depth is legible without relying on hue alone; node type
is carried by **shape** (square = human, diamond = agent, disc = tool) and the temporary tool adds a
**dashed rim**.

## Type

Kept the host site's typography (the brief requires it): `Iowan Old Style / Palatino / Georgia`
serif for headings and the node's own label styling, `Inter` for body copy, `JetBrains Mono` for
SPIFFE IDs, scopes, diffs and chips. The skill's Fira Code / Fira Sans dashboard pairing was
rejected — it would introduce a second type system on a site that already has one.

## Motion rules

| Motion | Duration | Easing | Notes |
|--------|----------|--------|-------|
| Token travel (one hop) | 1150ms × speed | ease-in-out on the segment | The only bold element; 1–2 tokens in flight |
| Token trail | 7 samples | linear fade | Short, additive |
| Scope contraction on delegation | 600ms | ease-out | 10% shrink — the most a child may grow and still stay inside its parent |
| Scope rim breathing (idle) | ≈7s cycle | sine | ±3.5% brightness only, and only while playing |
| Idle particle drift | continuous | sine | One or two motes, ~6px/s |
| Rejection shockwave | <1000ms | ease-out | Single expanding red ring from the parent boundary |
| Offending scope flash | ~550ms | ease-out | Red rim pulse |
| Issued token pop-in | ~700ms | ease-out | New marker scales in |
| Hover brighten | 200ms | ease | Rim + tooltip |
| Chip appear / fade | 250ms | ease | Shows the real `caveat_diff` string |

Reduced motion: the loop starts paused, the Play button is visible, no token travels, no idle
particles drift and the rim does not breathe. Pressing Play opts in.

## Accessibility rules

1. **Contrast** — body text ≥ 4.5:1 on the background; dim text is only ever secondary metadata.
2. **Never colour alone** — node type is shape-coded (square / diamond / disc), the temporary tool
   has a dashed rim, every decision chip carries text, and the side panel states the verdict in
   words.
3. **Focus** — a visible 2px gold outline on every interactive element; the canvas is focusable and
   announces the selection through an `aria-live` region.
4. **Keyboard** — arrow keys move between agents, Tab follows visual order, the node list in the
   side panel is a set of buttons, and all three actions (widen / narrow / replay) are reachable.
5. **Reduced motion** — respected as above, and the static view is a complete view of the diagram.
6. **Text alternatives** — the canvas carries a descriptive `aria-label`, and the side panel is the
   data table behind it.

## Values that were chosen here rather than read from the data

The delegation logic, scopes, SPIFFE IDs, narrowing diffs and the rejection message all come from
the AgentIAM source. The **visual** constants below are invented for this demo and are documented
here on purpose:

- the radius ratio per hop (`0.62 / 0.62 / 0.60 / 0.50`), the placement factor and the directions of
  each child inside its parent;
- the colour ramp (the palette above) — AgentIAM does not define colours for scopes;
- the contraction factor of 10% (chosen as the largest value that keeps a child ring inside its
  parent);
- the timings and the particle counts;
- the label offsets and the collision-avoidance distances.
