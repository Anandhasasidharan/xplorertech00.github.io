/* ---------------------------------------------------------------------------
 * webgpu-lab / src/gatekeeper.js
 *
 * Three.js rendering layer for the SENTRIX reference-monitor demo.
 *
 * The tool calls, policy, classifier patterns and decisions all come from
 * shared/data.js — untouched. This file only draws them: glowing particles
 * streaming along lanes into a gate, where allowed calls pass with a flash,
 * flagged calls slow down and change shape, and blocked calls break apart.
 * ------------------------------------------------------------------------- */

import "../shared/data.js";
import {
  Vector3,
  Mesh,
  Line,
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  SphereGeometry,
  OctahedronGeometry,
  BoxGeometry,
  TorusGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  DoubleSide,
  MathUtils
} from "three/webgpu";
import { Lab, PALETTE, GLOW, prefersReducedMotion, readFlags } from "../shared/scene.js";

const S = window.LabData.SENTRIX;
const calls = S.toolCalls;

const COLOUR = {
  travel: GLOW.token,
  allowed: PALETTE.green,
  flagged: PALETTE.amber,
  blocked: PALETTE.red,
  gate: PALETTE.gold,
  gateHot: PALETTE.goldBright,
  lane: "#787f92"
};

const LABEL_FOR = { allowed: "ALLOWED", flagged: "FLAGGED", blocked: "BLOCKED" };
const GLYPH = { allowed: "\u25CF", flagged: "\u25C6", blocked: "\u25A0" };
const CLASS = { allowed: "g-allowed", flagged: "g-flagged", blocked: "g-blocked" };

/* Visual constants (not from SENTRIX): lane count, spacing, speeds, sizes. */
const LANES = 5;
const LANE_Z = [-3.4, -1.7, 0, 1.7, 3.4];
const START_X = -9.6;
const END_X = 9.6;
const GATE_X = 0;
const GATE_RADIUS = 3.3;
const SPAWN_SECONDS = 1.5;

const canvas = document.getElementById("stage");
const tooltip = document.getElementById("tooltip");
const live = document.getElementById("live");
const detail = document.getElementById("detail");
const callsEl = document.getElementById("calls");
const stageHost = canvas.parentNode;
const fallback = document.getElementById("no-gpu");

const flags = readFlags();
const reduced = prefersReducedMotion();

const decisionCache = {};
calls.forEach((c) => {
  decisionCache[c.id] = S.decide(c);
});

const lab = new Lab({
  canvas: canvas,
  overlay: stageHost,
  reduced: reduced,
  view: {
    target: new Vector3(0, 0, 0),
    distance: 13.2,
    polar: 1.12,
    azimuth: 0.78,
    minDistance: 7,
    maxDistance: 22,
    maxAzimuth: 1.15
  }
});

/* state */
let selectedId = null;
let hoverId = null;
let speed = 1;
let spawnTimer = 0;
let nextIndex = 0;
let laneCursor = 0;
const counters = { allowed: 0, flagged: 0, blocked: 0 };
const filters = { allowed: true, flagged: true, blocked: true };
let gatePulse = 0;
let gateFlash = 0;

/* pools — nothing is allocated per frame */
const particles = [];
const fragments = [];
const pulses = [];

const tmpVec = new Vector3();
const tmpProj = { x: 0, y: 0, visible: false };
const tmpColour = new Color();
const COL_GATE = new Color(COLOUR.gate);
const COL_HOT = new Color(COLOUR.gateHot);
const COL_BLOCK = new Color(COLOUR.blocked);

let gateRing, gateGlow, gateDisc, gateMat, gateGlowMat;
let travelMesh, flagMesh, fragMesh, trailMesh;

/* ---------------------------------------------------------------- */
/* Scene                                                             */
/* ---------------------------------------------------------------- */

function buildScene() {
  /* lanes */
  const laneMat = new LineBasicMaterial({
    color: new Color(COLOUR.lane),
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < LANES; i++) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([START_X, 0, LANE_Z[i], END_X, 0, LANE_Z[i]]), 3));
    lab.scene.add(new Line(geo, laneMat));
  }

  /* gate: a ring/portal the calls must pass through */
  gateMat = new MeshBasicMaterial({
    color: new Color(COLOUR.gate),
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  gateRing = new Mesh(new TorusGeometry(GATE_RADIUS, 0.035, 8, 128), gateMat);
  gateRing.rotation.y = Math.PI / 2;
  gateRing.position.set(GATE_X, 0, 0);
  lab.scene.add(gateRing);

  gateGlowMat = new MeshBasicMaterial({
    color: new Color(COLOUR.gateHot),
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false
  });
  gateGlow = new Mesh(new TorusGeometry(GATE_RADIUS + 0.16, 0.075, 8, 96), gateGlowMat);
  gateGlow.rotation.y = Math.PI / 2;
  gateGlow.position.set(GATE_X, 0, 0);
  lab.scene.add(gateGlow);

  const discMat = new MeshBasicMaterial({
    color: new Color(COLOUR.gate),
    transparent: true,
    opacity: 0.012,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide
  });
  gateDisc = new Mesh(new CircleGeometry(GATE_RADIUS, 96), discMat);
  gateDisc.rotation.y = Math.PI / 2;
  gateDisc.position.set(GATE_X, 0, 0);
  lab.scene.add(gateDisc);

  /* instanced particle pools */
  const sphere = new SphereGeometry(0.22, 18, 14);
  const octa = new OctahedronGeometry(0.26, 0);
  const box = new BoxGeometry(0.14, 0.14, 0.14);
  const spark = new SphereGeometry(0.055, 6, 6);

  const particleMat = () =>
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });

  travelMesh = lab.instances(sphere, particleMat(), 24);
  flagMesh = lab.instances(octa, particleMat(), 24);
  fragMesh = lab.instances(box, new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }), 120);
  trailMesh = lab.instances(spark, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }), 96);

  /* particle pool */
  for (let i = 0; i < 24; i++) {
    particles.push({
      active: false,
      call: null,
      decision: null,
      pos: new Vector3(),
      vel: new Vector3(),
      state: "travel",
      lane: 0,
      flash: 0,
      judged: false,
      trail: new Float32Array(10 * 3),
      trailAt: 0
    });
  }
  for (let i = 0; i < 120; i++) {
    fragments.push({
      active: false,
      pos: new Vector3(),
      vel: new Vector3(),
      life: 0,
      size: 1,
      spin: 0
    });
  }
  for (let i = 0; i < 4; i++) {
    const mat = new MeshBasicMaterial({
      color: new Color(COLOUR.gateHot),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    const m = new Mesh(new TorusGeometry(0.7, 0.03, 6, 48), mat);
    m.rotation.y = Math.PI / 2;
    m.visible = false;
    lab.scene.add(m);
    pulses.push({ mesh: m, mat: mat, life: 0 });
  }
}

/* ---------------------------------------------------------------- */
/* Spawn + update                                                    */
/* ---------------------------------------------------------------- */

function spawn() {
  if (nextIndex >= calls.length) {
    nextIndex = 0;
    laneCursor = 0;
  }
  const call = calls[nextIndex];
  const decision = decisionCache[call.id];
  nextIndex++;

  if (!filters[decision.verdict]) return;

  let p = null;
  for (let i = 0; i < particles.length; i++) {
    if (!particles[i].active) {
      p = particles[i];
      break;
    }
  }
  if (!p) return;
  const lane = laneCursor % LANES;
  laneCursor++;

  p.active = true;
  p.call = call;
  p.decision = decision;
  p.state = "travel";
  p.judged = false;
  p.flash = 0;
  p.lane = lane;
  p.trailAt = 0;
  p.pos.set(START_X, 0, LANE_Z[lane]);
  p.vel.set(2.4 + (lane % 3) * 0.18, 0, 0);
}

function shatter(p) {
  let made = 0;
  for (let i = 0; i < fragments.length && made < 14; i++) {
    const f = fragments[i];
    if (f.active) continue;
    f.active = true;
    f.life = 1;
    f.pos.copy(p.pos);
    const a = (made / 14) * Math.PI * 2;
    const speedV = 1.1 + (made % 4) * 0.5;
    f.vel.set((Math.random() - 0.5) * 0.8, Math.sin(a) * speedV, Math.cos(a) * speedV);
    f.size = 0.7 + (made % 3) * 0.25;
    f.spin = Math.random() * 6;
    made++;
  }
}

function firePulse(z, colour) {
  let p = null;
  for (let i = 0; i < pulses.length; i++) {
    if (pulses[i].life <= 0) {
      p = pulses[i];
      break;
    }
  }
  if (!p) return;
  p.life = 1;
  p.mesh.visible = true;
  p.mesh.position.set(GATE_X, 0, z);
  p.mesh.scale.setScalar(0.3);
  p.mat.color.set(colour);
  p.mat.opacity = 0.9;
}

function judge(p) {
  p.judged = true;
  const verdict = p.decision.verdict;
  counters[verdict]++;
  updateCounters();

  if (verdict === "blocked") {
    p.active = false;
    shatter(p);
    gatePulse = 1;
    firePulse(p.pos.z, COLOUR.blocked);
    announce("Blocked: " + p.call.tool + ". " + p.decision.reason);
  } else if (verdict === "flagged") {
    p.state = "flagged";
    p.vel.multiplyScalar(0.32);
    p.flash = 1;
    firePulse(p.pos.z, COLOUR.flagged);
    announce("Flagged: " + p.call.tool + ". " + p.decision.reason);
  } else {
    p.state = "passed";
    p.flash = 1;
    gateFlash = 1;
    firePulse(p.pos.z, COLOUR.allowed);
    announce("Allowed: " + p.call.tool + ". " + p.decision.reason);
  }
}

function update(dt) {
  spawnTimer -= dt;
  let inFlight = 0;
  for (let i = 0; i < particles.length; i++) if (particles[i].active) inFlight++;
  if (spawnTimer <= 0 && inFlight < 14) {
    spawn();
    spawnTimer = SPAWN_SECONDS;
  }

  const d = dt * speed;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    p.flash = Math.max(0, p.flash - dt * 3);
    p.pos.addScaledVector(p.vel, d);

    if (p.state === "travel") {
      p.pos.y = Math.sin(p.pos.x * 0.6 + p.lane) * 0.16;
      if (p.pos.x >= GATE_X) judge(p);
    } else if (p.state === "flagged") {
      p.pos.y = MathUtils.lerp(p.pos.y, 0.55, 1 - Math.pow(0.02, dt));
      p.pos.z = MathUtils.lerp(p.pos.z, LANE_Z[p.lane] + 0.5, 1 - Math.pow(0.02, dt));
    }

    /* trail ring buffer */
    const at = p.trailAt * 3;
    p.trail[at] = p.pos.x;
    p.trail[at + 1] = p.pos.y;
    p.trail[at + 2] = p.pos.z;
    p.trailAt = (p.trailAt + 1) % 10;

    if (p.pos.x > END_X + 1) p.active = false;
  }

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    if (!f.active) continue;
    f.life -= dt * 0.85;
    f.vel.y -= dt * 1.6;
    f.pos.addScaledVector(f.vel, d);
    f.spin += dt * 4;
    if (f.life <= 0) f.active = false;
  }

  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i];
    if (p.life <= 0) {
      p.mesh.visible = false;
      continue;
    }
    p.life -= dt / 0.45;
    const life = Math.max(0, p.life);
    p.mesh.scale.setScalar(MathUtils.lerp(0.3, 1.9, 1 - life));
    p.mat.opacity = life * 0.9;
    if (life <= 0) p.mesh.visible = false;
  }

  gatePulse = Math.max(0, gatePulse - dt / 0.6);
  gateFlash = Math.max(0, gateFlash - dt / 0.35);
}

/* ---------------------------------------------------------------- */
/* Draw                                                              */
/* ---------------------------------------------------------------- */

function draw() {
  travelMesh.begin();
  flagMesh.begin();
  fragMesh.begin();
  trailMesh.begin();

  const trailLen = lab.quality === "high" ? 8 : 3;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;

    const isFlagged = p.state === "flagged";
    const colour = isFlagged
      ? COLOUR.flagged
      : p.state === "passed"
        ? COLOUR.allowed
        : COLOUR.travel;
    const scale = 1 + p.flash * 0.55;

    if (isFlagged) {
      flagMesh.push(p.pos, scale, colour, p.pos.x * 0.6);
    } else {
      travelMesh.push(p.pos, scale, colour, 0);
    }

    for (let j = 0; j < trailLen; j++) {
      const idx = (p.trailAt - 1 - j + 20) % 10;
      const at = idx * 3;
      tmpVec.set(p.trail[at], p.trail[at + 1], p.trail[at + 2]);
      trailMesh.push(tmpVec, 1 - j / (trailLen + 2), colour, 0);
    }
  }

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    if (!f.active) continue;
    tmpColour.copy(COL_BLOCK).multiplyScalar(0.55 + f.life * 0.6);
    fragMesh.push(f.pos, f.size * (0.6 + f.life * 0.6), tmpColour, f.spin);
  }

  travelMesh.end();
  flagMesh.end();
  fragMesh.end();
  trailMesh.end();

  /* gate state: gold, warm flash on pass, red pulse on a block */
  gateMat.color.copy(COL_GATE).lerp(COL_BLOCK, gatePulse);
  gateMat.opacity = 0.8 + gateFlash * 0.2 - gatePulse * 0.15;
  gateGlowMat.color.copy(COL_HOT).lerp(COL_BLOCK, gatePulse * 0.9);
  gateGlowMat.opacity = 0.2 + gateFlash * 0.12 + gatePulse * 0.1;

}

/* Clamped tooltip placement for a hovered particle. */
let tooltipAnchor = { x: 0, y: 0 };
function positionTooltip() {
  tooltip.style.left = Math.min(tooltipAnchor.x + 16, canvas.clientWidth - 270) + "px";
  tooltip.style.top = Math.max(6, tooltipAnchor.y - 10) + "px";
}

/* ---------------------------------------------------------------- */
/* Counters, list, detail                                            */
/* ---------------------------------------------------------------- */

function updateCounters() {
  document.getElementById("c-allowed").textContent = counters.allowed;
  document.getElementById("c-flagged").textContent = counters.flagged;
  document.getElementById("c-blocked").textContent = counters.blocked;
}

function announce(text) {
  live.textContent = text;
}

function renderCalls() {
  callsEl.innerHTML = "";
  calls.forEach((call) => {
    const d = decisionCache[call.id];
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-current", selectedId === call.id ? "true" : "false");
    const glyph = document.createElement("span");
    glyph.className = "glyph " + CLASS[d.verdict];
    glyph.textContent = GLYPH[d.verdict];
    const name = document.createElement("span");
    name.textContent = call.tool;
    const tag = document.createElement("span");
    tag.className = "call-tag";
    tag.textContent = LABEL_FOR[d.verdict];
    b.appendChild(glyph);
    b.appendChild(name);
    b.appendChild(tag);
    b.addEventListener("click", () => select(call.id));
    li.appendChild(b);
    callsEl.appendChild(li);
  });
}

function select(id) {
  selectedId = id;
  renderCalls();
  renderDetail();
  const call = calls.filter((c) => c.id === id)[0];
  if (call) announce(LABEL_FOR[decisionCache[id].verdict] + ": " + call.tool + ". " + decisionCache[id].reason);
}

function renderDetail() {
  if (!selectedId) {
    detail.innerHTML = '<p class="empty">Hover a particle or pick a call from the list below.</p>';
    return;
  }
  const call = calls.filter((c) => c.id === selectedId)[0];
  const d = decisionCache[selectedId];
  const args = Object.keys(call.args)
    .map((k) => k + "=" + call.args[k])
    .join(", ");

  let html = '<dl class="kv">';
  html += "<dt>Tool</dt><dd>" + escapeHtml(call.tool) + "</dd>";
  html += "<dt>Arguments</dt><dd>" + escapeHtml(args) + "</dd>";
  html += "<dt>Provenance</dt><dd>" + escapeHtml(call.provenance) + "</dd>";
  html += "<dt>Source</dt><dd>" + escapeHtml(call.source) + "</dd>";
  html +=
    '<dt>Decision</dt><dd><span class="verdict ' +
    CLASS[d.verdict] +
    '"><span class="glyph ' +
    CLASS[d.verdict] +
    '">' +
    GLYPH[d.verdict] +
    "</span>" +
    LABEL_FOR[d.verdict] +
    "</span></dd>";
  html += "<dt>Enforced by</dt><dd>" + escapeHtml(d.layer) + "</dd>";
  html += "<dt>Classifier</dt><dd>" + d.classifierScore.toFixed(2) + " (threshold " + S.classifierThreshold + ")</dd>";
  html += "</dl>";
  html += '<div class="reason-box">' + escapeHtml(d.reason) + "</div>";
  if (d.classifierMatches && d.classifierMatches.length) {
    html +=
      '<div class="matches">matched: ' +
      d.classifierMatches
        .map((m) => escapeHtml(m.patternName) + " (" + m.severity + ")")
        .join(", ") +
      "</div>";
  }
  if (call.note) html += '<div class="call-note">' + escapeHtml(call.note) + "</div>";
  detail.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------------- */
/* Pointer                                                           */
/* ---------------------------------------------------------------- */

function hitTest(event) {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  let best = null;
  let bestD = 20;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    lab.project(p.pos, tmpProj);
    if (!tmpProj.visible) continue;
    const dx = tmpProj.x - mx;
    const dy = tmpProj.y - my;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

canvas.addEventListener("mousemove", (event) => {
  const p = hitTest(event);
  hoverId = p ? p.call.id : null;
  if (!p) {
    tooltip.style.display = "none";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  tooltipAnchor.x = event.clientX - rect.left;
  tooltipAnchor.y = event.clientY - rect.top;
  tooltip.style.display = "block";
  positionTooltip();
  const d = p.decision;
  tooltip.innerHTML =
    '<div class="t-title">' +
    escapeHtml(p.call.tool) +
    "</div>" +
    '<div class="verdict ' +
    CLASS[d.verdict] +
    '">' +
    GLYPH[d.verdict] +
    " " +
    LABEL_FOR[d.verdict] +
    "</div>" +
    '<div class="t-reason">' +
    escapeHtml(d.reason) +
    "</div>";
});

canvas.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
  hoverId = null;
});

canvas.addEventListener("click", (event) => {
  if (lab.drag.moved > 6) return;
  const p = hitTest(event);
  if (p) select(p.call.id);
});

/* ---------------------------------------------------------------- */
/* Toolbar                                                           */
/* ---------------------------------------------------------------- */

const speedInput = document.getElementById("speed");
speedInput.addEventListener("input", () => {
  speed = parseFloat(speedInput.value);
  document.getElementById("speed-val").textContent = speed.toFixed(2) + "x";
});

document.getElementById("restart").addEventListener("click", () => {
  particles.forEach((p) => {
    p.active = false;
  });
  fragments.forEach((f) => {
    f.active = false;
  });
  counters.allowed = counters.flagged = counters.blocked = 0;
  nextIndex = 0;
  laneCursor = 0;
  spawnTimer = 0;
  updateCounters();
  renderCalls();
  renderDetail();
  live.textContent = "Session restarted.";
});

document.querySelectorAll("[data-filter]").forEach((input) => {
  input.addEventListener("change", () => {
    filters[input.getAttribute("data-filter")] = input.checked;
  });
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && (event.target === document.body || event.target === canvas)) {
    event.preventDefault();
    lab.togglePlay();
  }
});

/* ---------------------------------------------------------------- */
/* Boot                                                              */
/* ---------------------------------------------------------------- */

function buildLabels() {
  lab.addLabel({
    id: "gate",
    text: "reference monitor",
    sub: "gate",
    offset: [0, -1],
    anchor: (out) => out.set(GATE_X, GATE_RADIUS + 0.55, 0)
  });
  lab.addLabel({
    id: "origin",
    text: "agent tool calls",
    sub: "inbound",
    offset: [0, 1],
    anchor: (out) => out.set(START_X + 0.8, 1.3, LANE_Z[0])
  });
}

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

      lab.addDust(200, { spread: 30, opacity: 0.2, size: 0.04 });
      if (flags.colourTest) lab.showColourProbe();
      buildLabels();

      updateCounters();
      renderCalls();
      renderDetail();

      window.__lab = {
        lab: lab,
        backend: lab.backend,
        select: select,
        counters: () => Object.assign({}, counters),
        particles: particles,
        labels: () => lab._labels.map((l) => ({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h }))
      };
      window.dispatchEvent(new CustomEvent("lab-ready", { detail: { backend: lab.backend } }));

      if (reduced) {
        lab.setPlaying(false);
        announce("Motion is reduced. Press Play to start the simulation.");
      } else {
        lab.setPlaying(true);
        announce("Streaming tool calls through the reference monitor.");
      }
    })
    .catch((err) => {
      lab.failed = true;
      stageHost.style.display = "none";
      fallback.dataset.on = "1";
      fallback.querySelector(".ng-reason").textContent =
        "The renderer could not start here. A still of the demo is shown below.";
    });
}

boot();
