/* ---------------------------------------------------------------------------
 * webgpu-lab / src/delegation-tree.js
 *
 * Three.js rendering layer for the AgentIAM delegation demo.
 *
 * The delegation chain, scopes, SPIFFE IDs, narrowing diffs and the rejection
 * message all come from shared/data.js — untouched. This file only draws them:
 * nested translucent shells, tokens with trails, shell contraction, the
 * rejection shockwave, and the panel.
 * ------------------------------------------------------------------------- */

import "../shared/data.js";
import {
  Vector3,
  Mesh,
  Group,
  SphereGeometry,
  BoxGeometry,
  OctahedronGeometry,
  RingGeometry,
  BufferGeometry,
  BufferAttribute,
  Line,
  LineSegments,
  LineBasicMaterial,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  BackSide,
  DoubleSide,
  Quaternion,
  MathUtils
} from "three/webgpu";
import { Lab, PALETTE, GLOW, prefersReducedMotion, readFlags, NoGpuError } from "../shared/scene.js";

const A = window.LabData.AGENTIAM;
const chain = A.chain;
const nodes = chain.nodes;

/* ---------------------------------------------------------------- */
/* Palette (docs/design-notes.md)                                    */
/* ---------------------------------------------------------------- */

const NODE_COLOUR = {
  "n-alice": { fill: PALETTE.gold, rim: PALETTE.goldBright },
  "n-manager": { fill: PALETTE.amber, rim: PALETTE.amberBright },
  "n-worker": { fill: PALETTE.teal, rim: PALETTE.tealBright },
  "n-tool": { fill: PALETTE.blue, rim: PALETTE.blueBright },
  "n-tool-temp": { fill: PALETTE.blue, rim: PALETTE.blueBright }
};

const SHAPE = {
  "n-alice": "square",
  "n-manager": "diamond",
  "n-worker": "diamond",
  "n-tool": "disc",
  "n-tool-temp": "disc"
};

const TYPE_LABEL = {
  "n-alice": "human",
  "n-manager": "agent",
  "n-worker": "agent",
  "n-tool": "tool",
  "n-tool-temp": "tool"
};

const TYPE_LONG = {
  "n-alice": "human operator",
  "n-manager": "agent",
  "n-worker": "agent",
  "n-tool": "tool",
  "n-tool-temp": "tool (temporary)"
};

/* Visual placement inside the parent shell. Ratios keep every child inside
   its parent; the directions spread the chain in 3D so nesting is readable
   from the default camera. These are visual constants, not AgentIAM data. */
const GEOM = {
  "n-manager": { ratio: 0.74, place: 1.0, dir: [0.45, 0.85, 0.28] },
  "n-worker": { ratio: 0.7, place: 1.0, dir: [0.95, 0.05, 0.31] },
  "n-tool": { ratio: 0.62, place: 1.0, dir: [0.25, -0.85, 0.46] },
  "n-tool-temp": { ratio: 0.5, place: 1.0, dir: [-0.75, -0.45, 0.48] }
};

const CONTRACT_GAP = 0.1; /* shell starts 10% larger, then settles to true size */
const CONTRACT_SECONDS = 0.6;
const TOKEN_SECONDS = 1.15;

/* ---------------------------------------------------------------- */
/* Data helpers                                                      */
/* ---------------------------------------------------------------- */

function nodeById(id) {
  for (let i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
  return null;
}

function chainTo(id) {
  const path = [];
  let cur = nodeById(id);
  while (cur) {
    path.unshift(cur.id);
    cur = cur.parent ? nodeById(cur.parent) : null;
  }
  return path;
}

function ancestorsOf(id) {
  const set = {};
  let cur = nodeById(id);
  while (cur) {
    set[cur.id] = true;
    cur = cur.parent ? nodeById(cur.parent) : null;
  }
  return set;
}

function descendantsOf(id) {
  const set = {};
  nodes.forEach((n) => {
    let cur = n;
    while (cur && cur.parent) {
      if (cur.parent === id) {
        set[n.id] = true;
        break;
      }
      cur = nodeById(cur.parent);
    }
  });
  return set;
}

function relatedTo(id) {
  const set = ancestorsOf(id);
  const desc = descendantsOf(id);
  for (const k in desc) if (Object.prototype.hasOwnProperty.call(desc, k)) set[k] = true;
  return set;
}

function unitLayout() {
  const L = {};
  L["n-alice"] = { pos: new Vector3(0, 0, 0), r: 1 };
  ["n-manager", "n-worker", "n-tool", "n-tool-temp"].forEach((id) => {
    const n = nodeById(id);
    const parent = L[n.parent];
    const g = GEOM[id];
    const r = parent.r * g.ratio;
    const dir = new Vector3(g.dir[0], g.dir[1], g.dir[2]).normalize();
    L[id] = {
      pos: parent.pos.clone().addScaledVector(dir, (parent.r - r) * g.place),
      r: r
    };
  });
  return L;
}

/* ---------------------------------------------------------------- */
/* Geometry helpers                                                  */
/* ---------------------------------------------------------------- */

function circleGeometry(segments, dashed) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    if (segments === 128) {
      pts.push(Math.cos(a0), Math.sin(a0), 0);
    } else if (!dashed || i % 2 === 0) {
      pts.push(Math.cos(a0), Math.sin(a0), 0);
      pts.push(Math.cos(a1), Math.sin(a1), 0);
    }
  }
  if (segments === 128) pts.push(1, 0, 0); /* close the loop for THREE.Line */
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  return g;
}

function markerGeometry(shape) {
  if (shape === "square") return new BoxGeometry(0.115, 0.115, 0.115);
  if (shape === "diamond") return new OctahedronGeometry(0.085, 0);
  return new SphereGeometry(0.062, 18, 14);
}

/* ---------------------------------------------------------------- */
/* Boot                                                              */
/* ---------------------------------------------------------------- */

const canvas = document.getElementById("stage");
const tooltip = document.getElementById("tooltip");
const live = document.getElementById("live");
const kvEl = document.getElementById("kv");
const scopesEl = document.getElementById("scopes");
const verdictEl = document.getElementById("verdict");
const nodesEl = document.getElementById("nodes");
const selectedName = document.getElementById("selected-name");
const stageHost = canvas.parentNode;
const fallback = document.getElementById("no-gpu");

const flags = readFlags();
const reduced = prefersReducedMotion();

const layout = unitLayout();
const centroid = new Vector3();
nodes.forEach((n) => centroid.add(layout[n.id].pos));
centroid.multiplyScalar(1 / nodes.length);

let selectedId = "n-worker";
let hoverId = null;

const lab = new Lab({
  canvas: canvas,
  overlay: stageHost,
  reduced: reduced,
  view: {
    target: centroid.clone().multiplyScalar(0.3),
    distance: 5.6,
    polar: 1.05,
    azimuth: 0.62,
    minDistance: 2.8,
    maxDistance: 11,
    maxAzimuth: 1.0
  }
});

const sceneNodes = {};
const edgeLines = [];
const tokens = [];
const shards = [];
let shockwave = null;
let chipNode = null;
let chipUntil = 0;
const trail = { mesh: null, capacity: 64, cursor: 0 };

let relatedSet = {};

const tmpVec = new Vector3();
const tmpVec2 = new Vector3();
const tmpProj = { x: 0, y: 0, visible: false };
const zAxis = new Vector3(0, 0, 1);
const tmpQuat = new Quaternion();

/* state */
let elapsed = 0;
let flows = [];
let flowTimer = 0;
let playing = !reduced;

function boot() {
  buildScene();

  return lab
    .init()
    .then(() => {
      lab.bindControls({
        play: document.getElementById("play"),
        quality: document.getElementById("quality"),
        reset: document.getElementById("reset")
      });
      lab.onUpdate = update;
      lab.onFrame = draw;
      lab.onQualityDrop = () => {
        lab.hudQuality.textContent = "Low quality on automatically — average frame time stayed above 20 ms.";
        lab.hudQuality.dataset.on = "1";
      };

      lab.addDust(240, { spread: 22, opacity: 0.22, size: 0.035 });
      lab.showColourProbe && flags.colourTest && lab.showColourProbe();

      buildLabels();
      relatedSet = relatedTo(selectedId);
      updateLabelTones();
      renderNodes();
      renderSelected();
      window.__lab = {
        lab: lab,
        backend: lab.backend,
        select: select,
        tryWiden: tryWiden,
        tryNarrow: tryNarrow,
        replay: replay,
        scene: sceneNodes,
        state: () => ({
          tokens: tokens.filter((t) => t.active).length,
          selected: selectedId,
          attempt: attempt ? { active: attempt.active, t: attempt.t, dur: attempt.duration, kind: attempt.kind } : null,
          elapsed: elapsed
        })
      };
      window.dispatchEvent(new CustomEvent("lab-ready", { detail: { backend: lab.backend } }));

      if (reduced) {
        lab.setPlaying(false);
        live.textContent = "Motion is reduced. Press Play to animate the delegation.";
      } else {
        lab.setPlaying(true);
        startFlows();
      }
    })
    .catch((err) => {
      showNoGpu(err);
    });
}

/* ---------------------------------------------------------------- */
/* Scene construction                                                */
/* ---------------------------------------------------------------- */

const shellGeo = new SphereGeometry(1, 44, 30);
const ringGeo = circleGeometry(128);
const dashGeo = circleGeometry(96, true);
const markerGeos = { square: markerGeometry("square"), diamond: markerGeometry("diamond"), disc: markerGeometry("disc") };
const markerGeo = (shape) => markerGeos[shape];

function buildScene() {
  /* dust is added by the Lab */

  nodes.forEach((n) => {
    const L = layout[n.id];
    const col = NODE_COLOUR[n.id];

    const shellMat = new MeshBasicMaterial({
      color: new Color(col.fill),
      transparent: true,
      opacity: 0.05,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide
    });
    const shell = new Mesh(shellGeo, shellMat);
    shell.position.copy(L.pos);
    shell.scale.setScalar(L.r);
    lab.scene.add(shell);

    const rimMat = new LineBasicMaterial({
      color: new Color(col.rim),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const ringA = new Line(ringGeo, rimMat);
    ringA.position.copy(L.pos);
    ringA.scale.setScalar(L.r);
    lab.scene.add(ringA);

    const rimMatB = rimMat.clone();
    const ringB = new Line(ringGeo, rimMatB);
    ringB.position.copy(L.pos);
    ringB.scale.setScalar(L.r);
    ringB.rotation.x = Math.PI / 2;
    lab.scene.add(ringB);

    const rimMatC = rimMat.clone();
    const ringC = new Line(ringGeo, rimMatC);
    ringC.position.copy(L.pos);
    ringC.scale.setScalar(L.r);
    ringC.rotation.y = Math.PI / 2;
    lab.scene.add(ringC);

    let dashed = null;
    if (n.id === "n-tool-temp") {
      const dashMat = new LineBasicMaterial({
        color: new Color(col.rim),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false
      });
      dashed = new LineSegments(dashGeo, dashMat);
      dashed.position.copy(L.pos);
      dashed.scale.setScalar(L.r);
      dashed.rotation.z = 0.6;
      lab.scene.add(dashed);
    }

    const mGeo = markerGeo(SHAPE[n.id]);
    const markerMat = new MeshBasicMaterial({ color: new Color(col.rim), toneMapped: false, transparent: true });
    const marker = new Mesh(mGeo, markerMat);
    marker.position.copy(L.pos);
    lab.scene.add(marker);

    const haloMat = new MeshBasicMaterial({
      color: new Color(col.rim),
      transparent: true,
      opacity: 0.12,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const halo = new Mesh(shellGeo, haloMat);
    halo.position.copy(L.pos);
    halo.scale.setScalar(0.16);
    lab.scene.add(halo);

    sceneNodes[n.id] = {
      data: n,
      pos: L.pos,
      r: L.r,
      shell: shell,
      shellMat: shellMat,
      ringA: ringA,
      ringB: ringB,
      rimMat: rimMat,
      rimMatB: rimMatB,
      rimMatC: rimMatC,
      ringC: ringC,
      dashed: dashed,
      marker: marker,
      markerMat: markerMat,
      halo: halo,
      haloMat: haloMat,
      contract: 0,
      contractTarget: 0,
      flash: 0,
      pop: 0,
      chosen: 0
    };
  });

  /* delegation edges */
  nodes.forEach((n) => {
    if (!n.parent) return;
    const a = layout[n.parent].pos;
    const b = layout[n.id].pos;
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]), 3));
    const mat = new LineBasicMaterial({
      color: new Color(PALETTE.gold),
      transparent: true,
      opacity: 0.26,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const line = new Line(geo, mat);
    line.material = mat;
    lab.scene.add(line);
    edgeLines.push({ id: n.id, line: line, mat: mat });
  });

  /* token pool */
  const tokenGeo = new SphereGeometry(0.048, 16, 12);
  const glowGeo = new SphereGeometry(0.15, 16, 12);
  for (let i = 0; i < 3; i++) {
    const group = new Group();
    const core = new Mesh(
      tokenGeo,
      new MeshBasicMaterial({ color: new Color(GLOW.token), toneMapped: false })
    );
    const glow = new Mesh(
      glowGeo,
      new MeshBasicMaterial({
        color: new Color(PALETTE.gold),
        transparent: true,
        opacity: 0.3,
        blending: AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(glow);
    group.add(core);
    group.visible = false;
    lab.scene.add(group);
    tokens.push({
      group: group,
      core: core,
      glow: glow,
      active: false,
      path: null,
      seg: 0,
      t: 0,
      duration: TOKEN_SECONDS,
      kind: "delegate",
      onArrive: null,
      trail: new Float32Array(12 * 3),
      trailAt: 0,
      trailFill: 0,
      last: new Vector3()
    });
  }

  /* trail instances */
  trail.mesh = lab.instances(new SphereGeometry(0.035, 8, 6), trailMaterial(), 48);

  /* red shockwave */
  const ringMat = new MeshBasicMaterial({
    color: new Color(PALETTE.red),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide
  });
  shockwave = new Mesh(new RingGeometry(0.82, 1, 72), ringMat);
  shockwave.visible = false;
  lab.scene.add(shockwave);
  shockwave.userData.life = 0;

  /* shards for a blocked attempt */
  const shardGeo = new BoxGeometry(0.05, 0.05, 0.05);
  for (let i = 0; i < 18; i++) {
    const mat = new MeshBasicMaterial({
      color: new Color(PALETTE.red),
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const m = new Mesh(shardGeo, mat);
    m.visible = false;
    lab.scene.add(m);
    shards.push({ mesh: m, mat: mat, active: false, v: new Vector3(), life: 0 });
  }
}

function trailMaterial() {
  return new MeshBasicMaterial({
    color: new Color(GLOW.trail),
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false
  });
}

/* ---------------------------------------------------------------- */
/* Labels                                                            */
/* ---------------------------------------------------------------- */

function buildLabels() {
  nodes.forEach((n) => {
    const L = layout[n.id];
    const offset =
      n.id === "n-alice" ? [0, 1.35] : n.id === "n-manager" ? [1, -0.85] : n.id === "n-worker" ? [1.5, 0.1] : n.id === "n-tool" ? [0.7, 1.1] : [-1.2, 0.95];
    lab.addLabel({
      id: n.id,
      text: n.label,
      sub: TYPE_LABEL[n.id],
      offset: offset,
      distance: 48,
      anchor: (out) => out.copy(L.pos)
    });
  });
}

function updateLabelTones() {
  const related = relatedSet;
  nodes.forEach((n) => {
    lab.setLabelTone(n.id, n.id === selectedId ? "active" : related[n.id] ? "" : "dim");
  });
}

/* ---------------------------------------------------------------- */
/* Chips                                                             */
/* ---------------------------------------------------------------- */

function chipEl(id) {
  return document.getElementById("chip-" + id);
}

function showChip(id, text, kind) {
  hideChip();
  const el = chipEl(id);
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind || "info";
  el.dataset.on = "1";
  chipNode = id;
  chipUntil = elapsed + 2.4;
}

function hideChip() {
  if (chipNode) {
    const el = chipEl(chipNode);
    if (el) el.dataset.on = "0";
  }
  chipNode = null;
}

function positionChips() {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const el = chipEl(n.id);
    if (!el || el.dataset.on !== "1") return;
    lab.project(layout[n.id].pos, tmpProj);
    const w = el.offsetWidth || 140;
    const x = Math.max(w / 2 + 8, Math.min(lab.width - w / 2 - 8, tmpProj.x));
    const y = Math.max(14, Math.min(lab.height - 16, tmpProj.y + 40));
    el.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0) translate(-50%,0)";
  }
}

/* ---------------------------------------------------------------- */
/* Flow                                                              */
/* ---------------------------------------------------------------- */

function startFlows() {
  flows = [];
  nodes.forEach((n) => {
    sceneNodes[n.id].contract = 0;
    sceneNodes[n.id].contractTarget = 0;
    sceneNodes[n.id].pop = 0;
  });
  const isParent = {};
  nodes.forEach((n) => {
    if (n.parent) isParent[n.parent] = true;
  });
  const leaves = nodes.filter((n) => !isParent[n.id]);
  leaves.forEach((leaf, i) => {
    flows.push({ path: chainTo(leaf.id), seg: 0, delay: i * 0.6 });
  });
  flowTimer = 0;
}

function spawnToken(path, fromIndex, kind) {
  const free = tokens.filter((t) => !t.active)[0];
  if (!free) return null;
  free.active = true;
  free.path = path;
  free.seg = fromIndex;
  free.t = 0;
  free.kind = kind || "delegate";
  free.duration = TOKEN_SECONDS;
  free.trailFill = 0;
  free.trailAt = 0;
  free.group.visible = true;
  free.group.position.copy(layout[path[fromIndex]].pos);
  return free;
}

function tokenPosition(tk, out) {
  const from = layout[tk.path[tk.seg]].pos;
  const to = layout[tk.path[tk.seg + 1]].pos;
  const t = MathUtils.clamp(tk.t, 0, 1);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return out.copy(from).lerp(to, e);
}

function update(dt, now) {
  elapsed = now;
  flowTimer -= dt;

  if (flowTimer <= 0 && flows.length) {
    const f = flows[0];
    if (f.delay > 0) {
      f.delay -= 0.1;
      flowTimer = 0.1;
    } else {
      flows.shift();
      spawnToken(f.path, 0, "delegate");
      flowTimer = 0.45;
    }
  }

  updateTokens(dt);
  updateAttempt(dt);
  updateShockwave(dt);
  updateShards(dt);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const s = sceneNodes[n.id];
    if (s.contract < (s.contractTarget || 0)) {
      s.contract = Math.min(1, s.contract + dt / CONTRACT_SECONDS);
    }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 1.7);
    if (s.pop > 0) s.pop = Math.max(0, s.pop - dt * 1.35);

    /* shell contracts by the attenuation: 1 + gap*(1-contract) */
    const factor = 1 + CONTRACT_GAP * (1 - s.contract);
    s.shell.scale.setScalar(s.r * factor);
    s.ringA.scale.setScalar(s.r * factor);
    s.ringB.scale.setScalar(s.r * factor);
    s.ringC.scale.setScalar(s.r * factor);
    if (s.dashed) s.dashed.scale.setScalar(s.r * factor);
  }

  if (chipNode && elapsed > chipUntil) hideChip();
}

function updateTokens(dt) {
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (!tk.active || tk.kind !== "delegate") continue;
    tk.t += dt / tk.duration;

    if (tk.t >= 1) {
      const arrivedAt = tk.path[tk.seg + 1];
      const parentId = tk.path[tk.seg];
      const parent = nodeById(parentId);
      const child = nodeById(arrivedAt);
      const s = sceneNodes[arrivedAt];
      s.contractTarget = 1;
      s.contract = 0;
      s.pop = 0.5;
      showChip(arrivedAt, A.caveatDiff(parent.caveats, child.caveats), "info");
      live.textContent =
        child.label + " receives " + A.caveatDiff(parent.caveats, child.caveats) + ".";

      if (tk.seg + 2 < tk.path.length) {
        tk.seg++;
        tk.t = 0;
      } else {
        tk.active = false;
        tk.group.visible = false;
      }
    }

    if (!tk.active) continue;
    tokenPosition(tk, tmpVec);
    tk.group.position.copy(tmpVec);

    /* trail: one sample every frame into a small ring buffer */
    tk.last.copy(tmpVec);
    const at = tk.trailAt * 3;
    tk.trail[at] = tmpVec.x;
    tk.trail[at + 1] = tmpVec.y;
    tk.trail[at + 2] = tmpVec.z;
    tk.trailAt = (tk.trailAt + 1) % 12;
    tk.trailFill = Math.min(12, tk.trailFill + 1);
  }
}

/* "try to widen scope": a token leaves the selected node, hits the parent
   boundary and is refused there. */
let attempt = null;

function beginAttempt(nodeId, targetPos, onArrive, opts) {
  const free = tokens.filter((t) => !t.active)[0];
  if (!free) return;
  free.active = true;
  free.kind = "attempt";
  free.path = null;
  free.seg = 0;
  free.t = 0;
  free.duration = (opts && opts.duration) || 0.55;
  free.from = layout[nodeId].pos.clone();
  free.to = targetPos.clone();
  free.onArrive = onArrive;
  free.trailFill = 0;
  free.group.visible = true;
  free.group.position.copy(free.from);
  free.group.children[0].material.color.set(PALETTE.red);
  free.group.children[1].material.color.set(PALETTE.red);
  attempt = free;
}

function updateAttempt(dt) {
  if (!attempt || !attempt.active) return;
  attempt.t += dt / attempt.duration;
  const t = MathUtils.clamp(attempt.t, 0, 1);
  const e = 1 - Math.pow(1 - t, 3);
  tmpVec.copy(attempt.from).lerp(attempt.to, e);
  attempt.group.position.copy(tmpVec);

  if (t >= 1) {
    const done = attempt.onArrive;
    attempt.active = false;
    attempt.group.visible = false;
    const tk = attempt;
    attempt = null;
    /* reset the shared token colours for the next delegation */
    tk.group.children[0].material.color.set(PALETTE.gold);
    tk.group.children[1].material.color.set(GLOW.token);
    if (done) done();
  }
}

function updateShockwave(dt) {
  if (!shockwave || shockwave.userData.life <= 0) {
    if (shockwave) shockwave.visible = false;
    return;
  }
  shockwave.userData.life -= dt / 0.7;
  const life = Math.max(0, shockwave.userData.life);
  shockwave.scale.setScalar(MathUtils.lerp(0.25, 1.7, 1 - life));
  shockwave.material.opacity = life * 0.85;
  if (life <= 0) shockwave.visible = false;
}

function fireShockwave(point, normal) {
  if (!shockwave) return;
  shockwave.position.copy(point);
  tmpQuat.setFromUnitVectors(zAxis, normal.clone().normalize());
  shockwave.quaternion.copy(tmpQuat);
  shockwave.userData.life = 1;
  shockwave.visible = true;
  shockwave.scale.setScalar(0.25);
  shockwave.material.opacity = 0.9;
}

function burstShards(point) {
  let n = 0;
  for (let i = 0; i < shards.length && n < 14; i++) {
    const s = shards[i];
    if (s.active) continue;
    s.active = true;
    s.life = 1;
    s.mesh.visible = true;
    s.mesh.position.copy(point);
    const a = (n / 14) * Math.PI * 2;
    s.v.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9 + 0.2, (Math.random() - 0.5) * 0.6);
    n++;
  }
}

function updateShards(dt) {
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (!s.active) continue;
    s.life -= dt * 1.6;
    s.v.y -= dt * 1.4;
    s.mesh.position.addScaledVector(s.v, dt);
    s.mesh.rotation.x += dt * 3;
    s.mat.opacity = Math.max(0, s.life);
    if (s.life <= 0) {
      s.active = false;
      s.mesh.visible = false;
    }
  }
}

/* ---------------------------------------------------------------- */
/* Draw                                                              */
/* ---------------------------------------------------------------- */

function draw() {
  const breath = playing && !lab.reduced ? 1 + Math.sin(elapsed * 0.9) * 0.035 : 1;
  const related = relatedSet;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const s = sceneNodes[n.id];
    const dim = related[n.id] ? 1 : 0.35;
    const isSel = n.id === selectedId;
    const isHover = n.id === hoverId;

    let rim = 0.34 * breath * dim;
    if (isSel) rim = 0.95 * breath;
    if (isHover) rim = Math.max(rim, 0.8);

    s.shellMat.opacity = (isSel ? 0.06 : 0.028) * dim;
    s.rimMat.opacity = rim;
    s.rimMatB.opacity = rim * 0.8;
    s.rimMatC.opacity = rim * 0.6;
    s.rimMat.color.set(s.flash > 0 ? PALETTE.red : NODE_COLOUR[n.id].rim);
    s.rimMatB.color.copy(s.rimMat.color);
    s.rimMatC.color.copy(s.rimMat.color);
    if (s.dashed) {
      s.dashed.material.opacity = rim * 0.9;
      s.dashed.material.color.set(s.flash > 0 ? PALETTE.red : NODE_COLOUR[n.id].rim);
    }

    /* rejection flash */
    if (s.flash > 0) {
      s.shellMat.color.set(PALETTE.red);
      s.shellMat.opacity = 0.05 + s.flash * 0.09;
    } else {
      s.shellMat.color.set(NODE_COLOUR[n.id].fill);
    }

    /* marker: shape carries the node type, size carries selection */
    const markerScale = (isSel ? 1.35 : 1) * 1.3 * (1 + s.pop * 0.7);
    s.marker.scale.setScalar(markerScale);
    s.markerMat.color.set(s.flash > 0 ? PALETTE.red : NODE_COLOUR[n.id].rim);
    s.markerMat.opacity = dim;

    s.halo.visible = isSel || isHover || s.pop > 0;
    s.haloMat.opacity = (isHover ? 0.2 : 0.12) * dim + s.pop * 0.1;
    s.halo.scale.setScalar(0.2 * markerScale * (s.pop > 0 ? 1 + s.pop : 1));

    /* the three rims are already oriented; keep them stable while orbiting */
    s.ringB.rotation.x = Math.PI / 2;
  }

  for (let i = 0; i < edgeLines.length; i++) {
    const e = edgeLines[i];
    e.mat.opacity = related[e.id] ? 0.3 : 0.1;
  }

  /* trails */
  trail.mesh.begin();
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (!tk.active || tk.kind !== "delegate") continue;
    const max = lab.quality === "high" ? 12 : 5;
    for (let j = 0; j < max; j++) {
      const idx = (tk.trailAt - 1 - j + 24) % 12;
      const at = idx * 3;
      tmpVec.set(tk.trail[at], tk.trail[at + 1], tk.trail[at + 2]);
      const alpha = (1 - j / max) * 0.5;
      tmpVec2.copy(tmpVec);
      trail.mesh.push(tmpVec2, 0.55 + alpha, GLOW.trail, 0);
    }
  }
  trail.mesh.end();

  positionChips();
}

/* ---------------------------------------------------------------- */
/* Attempts                                                          */
/* ---------------------------------------------------------------- */

function showVerdict(kind, message, detail) {
  verdictEl.className = "verdict show " + kind;
  verdictEl.innerHTML = "<strong>" + esc(message) + "</strong><code>" + esc(detail) + "</code>";
  live.textContent = message + " " + detail;
}

function tryWiden() {
  const n = nodeById(selectedId);
  const parent = n && n.parent ? nodeById(n.parent) : null;
  if (!parent || !parent.held) {
    showVerdict(
      "rejected",
      "No parent scope to widen from",
      "The root of authority holds no delegated token, so there is nothing to widen."
    );
    return;
  }

  const parentScope = { kind: "scope", value: parent.held };
  const attemptCaveat = A.widenedAttempt(parentScope);
  const valid = A.isValidAttenuation(parent.caveats, [attemptCaveat]);
  const diff = A.caveatDiff(parent.caveats, [attemptCaveat]);

  const parentPos = layout[parent.id].pos;
  const childPos = layout[n.id].pos;
  tmpVec2.copy(childPos).sub(parentPos).normalize();
  const boundary = parentPos.clone().addScaledVector(tmpVec2, layout[parent.id].r * 1.06);

  if (!valid) {
    const exceeded = [];
    const parentResources = parent.held.resources || [];
    const parentOps = parent.held.operations || [];
    (attemptCaveat.value.resources || []).forEach((r) => {
      const covered = parentResources.some((pr) => A.pathNarrow(r, pr));
      if (!covered)
        exceeded.push('resource "' + r + '" is outside "' + (parentResources.join(", ") || "no resources") + '"');
    });
    (attemptCaveat.value.operations || []).forEach((o) => {
      if (parentOps.indexOf(o) === -1)
        exceeded.push('operation "' + o + '" is not in "' + (parentOps.join(", ") || "no operations") + '"');
    });

    beginAttempt(selectedId, boundary, () => {
      sceneNodes[selectedId].flash = 1;
      fireShockwave(boundary, tmpVec2);
      burstShards(boundary);
      showChip(selectedId, diff + " (expansion, blocked)", "rejected");
      showVerdict(
        "rejected",
        "Rejected — " + A.violationMessage,
        exceeded.join("; ") + ". attempted: " + diff + " (expansion, blocked)"
      );
    });
  } else {
    sceneNodes[selectedId].contract = 0;
    sceneNodes[selectedId].contractTarget = 1;
    showChip(selectedId, diff + " (issued)", "info");
    showVerdict("issued", "Issued — the attempt was a valid narrowing", "attempted: " + diff);
  }
}

function tryNarrow() {
  const n = nodeById(selectedId);
  const parent = n && n.parent ? nodeById(n.parent) : null;
  if (!parent || !parent.held) {
    showVerdict("rejected", "No parent scope to narrow from", "The root of authority holds no delegated token.");
    return;
  }
  const parentResources = parent.held.resources || [];
  const parentOps = parent.held.operations || [];
  if (!parentResources.length) {
    showVerdict("rejected", "Nothing to narrow", "The parent holds no resources.");
    return;
  }

  const first = parentResources[0];
  let childResource;
  if (first.slice(-2) === "/*") childResource = first.slice(0, -2) + "/narrowed-item";
  else if (first.slice(-3) === "/**") childResource = first.slice(0, -3) + "/narrowed-item";
  else childResource = first;

  const caveat = {
    kind: "scope",
    value: {
      resources: [childResource],
      operations: parentOps.length ? [parentOps[0]] : []
    }
  };
  const valid = A.isValidAttenuation(parent.caveats, [caveat]);
  const diff = A.caveatDiff(parent.caveats, [caveat]);

  if (valid) {
    const s = sceneNodes[selectedId];
    s.contract = 0;
    s.contractTarget = 1;
    s.pop = 1;
    showChip(selectedId, diff + " (issued)", "info");
    showVerdict("issued", "Issued — narrowing is allowed", "attempted: " + diff);
  } else {
    showVerdict("rejected", "Rejected — " + A.violationMessage, "attempted: " + diff);
  }
}

function replay() {
  hideChip();
  startFlows();
  lab.setPlaying(true);
  live.textContent = "Replaying the delegation from Alice.";
}

/* ---------------------------------------------------------------- */
/* Panel                                                             */
/* ---------------------------------------------------------------- */

function renderNodes() {
  nodesEl.innerHTML = "";
  nodes.forEach((n) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-current", n.id === selectedId ? "true" : "false");
    const glyph = document.createElement("span");
    glyph.className = "shape-glyph";
    glyph.style.color = NODE_COLOUR[n.id].rim;
    glyph.textContent = n.id === "n-alice" ? "\u25A0" : n.id === "n-tool" || n.id === "n-tool-temp" ? "\u25CF" : "\u25C6";
    const name = document.createElement("span");
    name.textContent = n.label;
    const role = document.createElement("span");
    role.className = "node-role";
    role.textContent = TYPE_LABEL[n.id];
    b.appendChild(glyph);
    b.appendChild(name);
    b.appendChild(role);
    b.addEventListener("click", () => select(n.id));
    b.addEventListener("mouseenter", () => {
      hoverId = n.id;
    });
    b.addEventListener("mouseleave", () => {
      hoverId = null;
    });
    li.appendChild(b);
    nodesEl.appendChild(li);
  });
}

function renderSelected() {
  const n = nodeById(selectedId);
  if (!n) return;
  selectedName.textContent = n.label;
  const parent = n.parent ? nodeById(n.parent) : null;

  let html = "";
  html += "<dt>Agent</dt><dd>" + esc(n.label) + "</dd>";
  html += "<dt>Type</dt><dd>" + esc(TYPE_LONG[n.id]) + "</dd>";
  html += "<dt>SPIFFE ID</dt><dd>" + esc(n.spiffe) + "</dd>";
  if (n.issuer) html += "<dt>Delegated by</dt><dd>" + esc(n.issuer) + "</dd>";
  if (parent) html += "<dt>Narrowing</dt><dd>" + esc(A.caveatDiff(parent.caveats, n.caveats)) + "</dd>";
  kvEl.innerHTML = html;

  scopesEl.innerHTML = "";
  if (n.held) {
    n.held.resources.forEach((r) => {
      const li = document.createElement("li");
      li.innerHTML = "<em>resource</em> " + esc(r);
      scopesEl.appendChild(li);
    });
    n.held.operations.forEach((o) => {
      const li = document.createElement("li");
      li.innerHTML = "<em>operation</em> " + esc(o);
      scopesEl.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.innerHTML = "<em>origin</em> holds no token scope — it is the root of authority";
    scopesEl.appendChild(li);
  }
  n.caveats.forEach((c) => {
    if (c.kind !== "condition") return;
    const li = document.createElement("li");
    li.innerHTML = "<em>condition</em> " + esc(c.value.time_before);
    scopesEl.appendChild(li);
  });
  if (n.condition) {
    const li = document.createElement("li");
    li.className = "scope-note";
    li.textContent = n.condition;
    scopesEl.appendChild(li);
  }
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function select(id) {
  selectedId = id;
  relatedSet = relatedTo(id);
  renderNodes();
  renderSelected();
  updateLabelTones();
  const n = nodeById(id);
  if (n) {
    live.textContent =
      n.label +
      " selected. Scope: " +
      (n.held ? n.held.resources.join(", ") + " — " + n.held.operations.join(", ") : "root of authority");
  }
}

/* ---------------------------------------------------------------- */
/* Pointer + keyboard on the canvas                                  */
/* ---------------------------------------------------------------- */

function nodeAtPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  let best = null;
  let bestD = Infinity;
  nodes.forEach((n) => {
    lab.project(layout[n.id].pos, tmpProj);
    const dx = tmpProj.x - mx;
    const dy = tmpProj.y - my;
    const d = Math.sqrt(dx * dx + dy * dy);
    /* screen radius of the shell */
    const camDist = lab.camera.position.distanceTo(layout[n.id].pos);
    const radiusPx = (layout[n.id].r * (lab.height / (2 * Math.tan((lab.camera.fov * Math.PI) / 360)))) / camDist;
    if (d < Math.max(radiusPx, 16) && d < bestD) {
      bestD = d;
      best = n;
    }
  });
  return best;
}

canvas.addEventListener("click", (event) => {
  if (lab.drag.moved > 6) return;
  const n = nodeAtPointer(event);
  if (n) select(n.id);
});

canvas.addEventListener("mousemove", (event) => {
  const n = nodeAtPointer(event);
  hoverId = n ? n.id : null;
  if (!n) {
    tooltip.style.display = "none";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const lines = [];
  if (n.held) {
    lines.push("resources: " + n.held.resources.join(", "));
    lines.push("operations: " + n.held.operations.join(", "));
  } else {
    lines.push("root of authority — holds no token scope");
  }
  const parent = n.parent ? nodeById(n.parent) : null;
  if (parent) lines.push("narrowing: " + A.caveatDiff(parent.caveats, n.caveats));

  tooltip.style.display = "block";
  tooltip.style.left = Math.min(event.clientX - rect.left + 16, canvas.clientWidth - 290) + "px";
  tooltip.style.top = Math.max(6, event.clientY - rect.top - 12) + "px";
  tooltip.innerHTML =
    '<div class="t-title">' +
    esc(n.label) +
    " · " +
    esc(TYPE_LONG[n.id]) +
    "</div>" +
    lines.map((l) => '<div class="t-line">' + esc(l) + "</div>").join("");
});

canvas.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
  hoverId = null;
});

canvas.addEventListener("keydown", (event) => {
  const ids = nodes.map((n) => n.id);
  const idx = ids.indexOf(selectedId);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    select(ids[Math.min(idx + 1, ids.length - 1)]);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    select(ids[Math.max(idx - 1, 0)]);
  }
});

/* ---------------------------------------------------------------- */
/* Toolbar                                                           */
/* ---------------------------------------------------------------- */

const speedInput = document.getElementById("speed");
speedInput.addEventListener("input", () => {
  lab.speed = parseFloat(speedInput.value);
  document.getElementById("speed-val").textContent = lab.speed.toFixed(2) + "x";
});

document.getElementById("replay").addEventListener("click", replay);
document.getElementById("widen").addEventListener("click", tryWiden);
document.getElementById("narrow").addEventListener("click", tryNarrow);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && (event.target === document.body || event.target === canvas)) {
    event.preventDefault();
    lab.togglePlay();
  }
});

/* ---------------------------------------------------------------- */
/* No-GPU fallback                                                   */
/* ---------------------------------------------------------------- */

function showNoGpu(err) {
  lab.failed = true;
  stageHost.style.display = "none";
  fallback.dataset.on = "1";
  fallback.querySelector(".ng-reason").textContent =
    "The renderer could not start here. A still of the demo is shown below.";
}

boot();
