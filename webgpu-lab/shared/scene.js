/* ---------------------------------------------------------------------------
 * webgpu-lab / shared/scene.js
 *
 * Rendering and interaction layer shared by both Three.js demos.
 *
 *   - WebGPURenderer (three/webgpu): uses WebGPU when the browser has it and
 *     falls back to WebGL 2 automatically. `?backend=webgl` forces the WebGL 2
 *     backend for testing.
 *   - one perspective camera, gentle pointer parallax, damped orbit + zoom,
 *     one-finger orbit and pinch zoom on touch, explicit Reset view.
 *   - optional soft bloom through RenderPipeline + BloomNode (High quality).
 *     Low quality renders the scene pass directly, so bloom and particle
 *     trails are off.
 *   - DOM labels with leader lines, collision avoidance and clamping.
 *   - a very faint dust field for depth.
 *   - paused-by-default under prefers-reduced-motion, with no parallax,
 *     no drift and no pulsing.
 *
 * Colours come from docs/design-notes.md. The renderer output colour space is
 * set explicitly; `Lab.showColourProbe()` draws palette swatches for the pixel
 * sampling check in the build verification.
 * ------------------------------------------------------------------------- */

import {
  WebGPURenderer,
  RenderPipeline,
  Scene,
  PerspectiveCamera,
  Color,
  Vector2,
  Vector3,
  SRGBColorSpace,
  NoToneMapping,
  Points,
  PointsMaterial,
  BufferGeometry,
  BufferAttribute,
  AdditiveBlending,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  InstancedMesh,
  Object3D,
  Quaternion,
  MathUtils,
  DynamicDrawUsage
} from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

/* Palette — keep in sync with docs/design-notes.md */
export const PALETTE = {
  ink: "#07080c",
  panel: "#0c1017",
  gold: "#d8b56c",
  goldBright: "#e8c88c",
  amber: "#e29e4a",
  amberBright: "#f0ba6e",
  teal: "#42a69c",
  tealBright: "#68c4ba",
  blue: "#5285c7",
  blueBright: "#7cace8",
  neutral: "#969288",
  red: "#ff5968",
  green: "#39ff88",
  bone: "#f2efe9",
  ash: "#b9b6ad",
  slate: "#7a7780"
};

/* Colours used as *emissive* accents (tokens, rims, fragments). */
export const GLOW = {
  token: "#fff6e0",
  trail: "#d8b56c"
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    return false;
  }
}

/** Query flags: ?backend=webgl forces WebGL 2, ?quality=low|high pins quality. */
export function readFlags() {
  const q = new URLSearchParams(window.location.search);
  return {
    forceWebGL: q.get("backend") === "webgl",
    quality: q.get("quality"),
    colourTest: q.get("colortest") === "1"
  };
}

export function hasWebGL2() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch (err) {
    return false;
  }
}

export class NoGpuError extends Error {}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/* ------------------------------------------------------------------ */
/* Lab                                                                 */
/* ------------------------------------------------------------------ */

export class Lab {
  constructor(options) {
    const opts = options || {};

    this.canvas = opts.canvas;
    this.overlay = opts.overlay || this.canvas.parentNode;
    this.reduced = opts.reduced !== false;
    this.flags = readFlags();
    this.forceWebGL = this.flags.forceWebGL;
    this.colourTest = this.flags.colourTest;

    this.scene = new Scene();
    this.scene.background = new Color(PALETTE.ink);

    this.camera = new PerspectiveCamera(42, 1, 0.1, 300);

    /* view state: spherical around a target */
    const view = opts.view || {};
    this.view = {
      target: new Vector3().copy(view.target || new Vector3(0, 0, 0)),
      distance: view.distance == null ? 7 : view.distance,
      polar: view.polar == null ? 1.06 : view.polar,
      azimuth: view.azimuth == null ? 0.55 : view.azimuth
    };
    this.home = {
      target: this.view.target.clone(),
      distance: this.view.distance,
      polar: this.view.polar,
      azimuth: this.view.azimuth
    };
    this.minDistance = view.minDistance == null ? this.view.distance * 0.55 : view.minDistance;
    this.maxDistance = view.maxDistance == null ? this.view.distance * 1.8 : view.maxDistance;
    this.minPolar = view.minPolar == null ? 0.42 : view.minPolar;
    this.maxPolar = view.maxPolar == null ? 1.44 : view.maxPolar;
    this.maxAzimuth = view.maxAzimuth == null ? 1.1 : view.maxAzimuth;

    this.parallax = new Vector2(0, 0);
    this.parallaxTarget = new Vector2(0, 0);
    this.drag = { active: false, id: -1, x: 0, y: 0, moved: 0 };
    this.pointers = new Map();
    this.pinchDist = 0;
    this.resetTween = 0;

    this.playing = !this.reduced;
    this.speed = 1;
    this.elapsed = 0;
    this.fps = 0;
    this.quality = "high";
    this.onQualityDrop = null;
    this.onUpdate = null;
    this.onFrame = null;
    this.backend = "WebGPU";
    this.ready = false;
    this.failed = false;

    this._frames = 0;
    this._fpsTimer = 0;
    this._slowFor = 0;
    this._frameTimes = 0;
    this._last = 0;
    this._raf = 0;
    this._modelMatrix = new Object3D();
    this._quat = new Quaternion();
    this._tmpV = new Vector3();
    this._tmpV2 = new Vector3();
    this._labels = [];
  }

  async init() {
    const canWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    if (!canWebGPU && !hasWebGL2()) throw new NoGpuError("This browser has neither WebGPU nor WebGL 2.");

    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      forceWebGL: this.forceWebGL
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._resize();
    await this.renderer.init();

    const backend = this.renderer.backend;
    this.backend = backend && backend.isWebGPUBackend === true ? "WebGPU" : "WebGL 2";

    this.pipeline = new RenderPipeline(this.renderer);
    this.scenePass = pass(this.scene, this.camera);
    this.sceneColour = this.scenePass.getTextureNode("output");
    this.bloomNode = bloom(this.sceneColour, 1.0, 0.42, 0.3);

    this._buildLabels();
    this._buildHud();
    this._attachControls();

    const narrow = window.innerWidth < 760;
    const pinned = this.flags.quality === "low" || this.flags.quality === "high" ? this.flags.quality : null;
    this.pinnedQuality = Boolean(pinned);
    this.setQuality(pinned || (narrow || this.colourTest ? "low" : "high"));

    this._observer = new ResizeObserver(() => this._resize());
    this._observer.observe(this.canvas.parentNode);

    this.ready = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame((t) => this._frame(t));
    return this;
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop                                                        */
  /* ---------------------------------------------------------------- */

  _frame(now) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    if (this.failed) return;

    const raw = (now - this._last) / 1000;
    this._last = now;
    const dt = clamp(raw, 0, 0.05);

    /* fps + adaptive quality */
    this._frames++;
    this._fpsTimer += raw;
    if (this._fpsTimer >= 0.5) {
      this.fps = Math.round(this._frames / this._fpsTimer);
      this._frames = 0;
      this._fpsTimer = 0;
      if (this.hudFps && this.hudFps.dataset.on === "1") {
        this.hudFps.textContent = this.fps + " fps · " + this.backend;
      }
    }
    if (this.quality === "high" && !this.colourTest && !this.pinnedQuality) {
      this._slowFor = raw > 0.02 ? this._slowFor + raw : Math.max(0, this._slowFor - raw * 2);
      if (this._slowFor > 2) {
        this._slowFor = 0;
        this.setQuality("low");
        if (this.onQualityDrop) this.onQualityDrop();
      }
    }

    this._updateCamera(dt);

    /* very slow dust drift — never under reduced motion, never when paused */
    if (this.dust && this.playing && !this.reduced) {
      this.dust.rotation.y += dt * 0.008;
      this.dust.position.y = Math.sin(this.elapsed * 0.12) * 0.3;
    }

    if (this.playing) {
      this.elapsed += dt * this.speed;
      if (this.onUpdate) this.onUpdate(dt * this.speed, this.elapsed);
    }
    if (this.onFrame) this.onFrame(dt, this.elapsed);

    this._updateLabels();

    this.pipeline.render();
  }

  /* ---------------------------------------------------------------- */
  /* Renderer size                                                     */
  /* ---------------------------------------------------------------- */

  _resize() {
    const host = this.canvas.parentNode;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._layoutProbe();
    if (this._svg) {
      this._svg.setAttribute("width", w);
      this._svg.setAttribute("height", h);
      this._svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Camera, orbit, parallax                                           */
  /* ---------------------------------------------------------------- */

  _cameraPose(dt) {
    const v = this.view;
    const k = 1 - Math.pow(0.001, dt);
    this.parallax.lerp(this.parallaxTarget, k);

    let az = v.azimuth;
    let polar = v.polar;
    let dist = v.distance;

    if (this.resetTween > 0) {
      this.resetTween = Math.max(0, this.resetTween - dt);
      const e = easeOut(clamp(1 - this.resetTween / 0.45, 0, 1));
      v.azimuth = MathUtils.lerp(v.azimuth, this.home.azimuth, e * 0.4);
      v.polar = MathUtils.lerp(v.polar, this.home.polar, e * 0.4);
      v.distance = MathUtils.lerp(v.distance, this.home.distance, e * 0.4);
      v.target.lerp(this.home.target, e * 0.4);
      az = v.azimuth;
      polar = v.polar;
      dist = v.distance;
      if (this.resetTween === 0) {
        v.azimuth = this.home.azimuth;
        v.polar = this.home.polar;
        v.distance = this.home.distance;
        v.target.copy(this.home.target);
      }
    }

    az += this.parallax.x * 3.4 * DEG;
    polar = clamp(polar + this.parallax.y * 2.6 * DEG, this.minPolar, this.maxPolar);

    const sp = Math.sin(polar);
    this.camera.position.set(
      v.target.x + dist * sp * Math.sin(az),
      v.target.y + dist * Math.cos(polar),
      v.target.z + dist * sp * Math.cos(az)
    );
    this.camera.lookAt(v.target);
  }

  _updateCamera(dt) {
    this._cameraPose(dt);
    this.camera.updateMatrixWorld();
  }

  resetView() {
    this.resetTween = 0.45;
    this.parallaxTarget.set(0, 0);
    this.parallax.set(0, 0);
  }

  /** Wire up the toolbar buttons. Each argument is optional. */
  bindControls(opts) {
    const o = opts || {};
    this.btnPlay = o.play || null;
    this.btnQuality = o.quality || null;
    this.btnReset = o.reset || null;
    if (this.btnPlay) {
      this.btnPlay.addEventListener("click", () => this.togglePlay());
    }
    if (this.btnQuality) {
      this.btnQuality.addEventListener("click", () => this.toggleQuality());
    }
    if (this.btnReset) {
      this.btnReset.addEventListener("click", () => this.resetView());
    }
    this._syncPlayButton();
  }

  _attachControls() {
    const c = this.canvas;

    const onDown = (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      if (this.pointers.size === 1) {
        this.drag.active = true;
        this.drag.id = e.pointerId;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        this.drag.moved = 0;
      } else if (this.pointers.size === 2) {
        this.drag.active = false;
        this.pinchDist = this._pointerSpread();
      }
      c.classList.add("is-dragging");
    };

    const onMove = (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (prev) {
        prev.x = e.clientX;
        prev.y = e.clientY;
      }

      /* pointer parallax (mouse only, never while dragging) */
      if (!this.reduced && e.pointerType === "mouse" && !this.drag.active) {
        const r = c.getBoundingClientRect();
        this.parallaxTarget.set(
          clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
          clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
        );
      }

      if (this.pointers.size >= 2) {
        const spread = this._pointerSpread();
        if (this.pinchDist > 0 && spread > 0) {
          this.view.distance = clamp(
            this.view.distance * (this.pinchDist / spread),
            this.minDistance,
            this.maxDistance
          );
        }
        this.pinchDist = spread;
        return;
      }

      if (!this.drag.active || e.pointerId !== this.drag.id) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);

      const scale = 0.0042;
      this.view.azimuth = clamp(this.view.azimuth - dx * scale, -this.maxAzimuth, this.maxAzimuth);
      this.view.polar = clamp(this.view.polar - dy * scale, this.minPolar, this.maxPolar);
    };

    const onUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.drag.id === e.pointerId) this.drag.active = false;
      if (this.pointers.size === 0) c.classList.remove("is-dragging");
      try {
        c.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* pointer may already be released */
      }
    };

    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") this.parallaxTarget.set(0, 0);
    });

    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = Math.exp(clamp(e.deltaY, -120, 120) * 0.0014);
        this.view.distance = clamp(this.view.distance * factor, this.minDistance, this.maxDistance);
      },
      { passive: false }
    );

    c.addEventListener("dblclick", () => this.resetView());
  }

  _pointerSpread() {
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------------------------------------------------------------- */
  /* Quality                                                           */
  /* ---------------------------------------------------------------- */

  setQuality(quality) {
    this.quality = quality === "high" ? "high" : "low";
    if (this.pipeline) {
      this.pipeline.outputNode =
        this.quality === "high" ? this.sceneColour.add(this.bloomNode) : this.sceneColour;
      this.pipeline.needsUpdate = true;
    }
    if (this.hudQuality) {
      this.hudQuality.textContent = this.quality === "high" ? "" : "Low quality — bloom and trails off";
      this.hudQuality.dataset.on = this.quality === "high" ? "0" : "1";
    }
    if (this.btnQuality) this.btnQuality.textContent = "Quality: " + (this.quality === "high" ? "High" : "Low");
    if (this.renderer) {
      this.renderer.setPixelRatio(
        this.quality === "high" ? Math.min(window.devicePixelRatio || 1, 2) : 1
      );
      this._resize();
    }
    return this.quality;
  }

  toggleQuality() {
    return this.setQuality(this.quality === "high" ? "low" : "high");
  }

  /* ---------------------------------------------------------------- */
  /* Play / pause                                                      */
  /* ---------------------------------------------------------------- */

  setPlaying(next) {
    this.playing = Boolean(next);
    this._syncPlayButton();
    return this.playing;
  }

  _syncPlayButton() {
    if (!this.btnPlay) return;
    this.btnPlay.textContent = this.playing ? "Pause" : "Play";
    this.btnPlay.setAttribute("aria-pressed", this.playing ? "true" : "false");
    this.btnPlay.classList.toggle("is-paused", !this.playing);
  }

  togglePlay() {
    return this.setPlaying(!this.playing);
  }

  /* ---------------------------------------------------------------- */
  /* Dust                                                              */
  /* ---------------------------------------------------------------- */

  addDust(count, opts) {
    const n = count || 220;
    const positions = new Float32Array(n * 3);
    const o = opts || {};
    const spread = o.spread || 26;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.55;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    const mat = new PointsMaterial({
      color: new Color(PALETTE.gold),
      size: o.size || 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: o.opacity == null ? 0.3 : o.opacity,
      depthWrite: false,
      blending: AdditiveBlending
    });
    const dust = new Points(geo, mat);
    dust.frustumCulled = false;
    this.scene.add(dust);
    this.dust = dust;
    return dust;
  }

  /* ---------------------------------------------------------------- */
  /* Instanced particles                                               */
  /* ---------------------------------------------------------------- */

  /**
   * A fixed-capacity instanced mesh. `begin()` resets the count, `push()`
   * writes one instance, `end()` uploads. Nothing is allocated per frame.
   */
  instances(geometry, material, capacity) {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    const colour = new Color();
    mesh.setColorAt(0, colour.set("#ffffff"));
    mesh.instanceColor.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    this.scene.add(mesh);

    const self = this;
    let i = 0;
    return {
      mesh: mesh,
      capacity: capacity,
      begin() {
        i = 0;
      },
      push(pos, scale, hex, rotY) {
        if (i >= capacity) return;
        const m = self._modelMatrix;
        m.position.copy(pos);
        m.scale.setScalar(scale);
        m.rotation.set(0, rotY || 0, 0);
        m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix);
        if (hex && hex.isColor) colour.copy(hex);
        else colour.set(hex);
        mesh.setColorAt(i, colour);
        i++;
      },
      pushQuat(pos, scale, hex, quat) {
        if (i >= capacity) return;
        const m = self._modelMatrix;
        m.position.copy(pos);
        m.quaternion.copy(quat);
        m.scale.setScalar(scale);
        m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix);
        if (hex && hex.isColor) colour.copy(hex);
        else colour.set(hex);
        mesh.setColorAt(i, colour);
        i++;
      },
      end() {
        mesh.count = i;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Projection helper                                                 */
  /* ---------------------------------------------------------------- */

  project(v3, out) {
    const v = this._tmpV.copy(v3).project(this.camera);
    const o = out || { x: 0, y: 0, visible: false };
    o.x = (v.x * 0.5 + 0.5) * this.width;
    o.y = (-v.y * 0.5 + 0.5) * this.height;
    o.visible = v.z < 1 && v.x > -1.3 && v.x < 1.3 && v.y > -1.3 && v.y < 1.3;
    return o;
  }

  /* ---------------------------------------------------------------- */
  /* DOM labels                                                        */
  /* ---------------------------------------------------------------- */

  _buildLabels() {
    const host = this.overlay;
    host.classList.add("lab-stage");
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "lab-leaders");
    svg.setAttribute("aria-hidden", "true");
    host.appendChild(svg);
    this._svg = svg;

    const box = document.createElement("div");
    box.className = "lab-labels";
    host.appendChild(box);
    this._labelBox = box;
  }

  /**
   * opts: { text, sub, anchor(): Vector3, offset:[x,y], id, tone }
   */
  addLabel(opts) {
    const el = document.createElement("div");
    el.className = "lab-label";
    const span = document.createElement("span");
    span.textContent = opts.text;
    el.appendChild(span);
    if (opts.sub) {
      const small = document.createElement("small");
      small.textContent = opts.sub;
      el.appendChild(small);
    }
    this._labelBox.appendChild(el);

    const svgNs = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(svgNs, "line");
    line.setAttribute("class", "lab-leader");
    this._svg.appendChild(line);

    const entry = {
      el: el,
      line: line,
      anchor: opts.anchor,
      offset: opts.offset || [0, -1],
      distance: opts.distance || 40,
      id: opts.id || "",
      visible: true,
      w: 0,
      h: 0,
      x: 0,
      y: 0,
      ax: 0,
      ay: 0
    };
    this._labels.push(entry);
    return entry;
  }

  _updateLabels() {
    const labels = this._labels;
    if (!labels.length) return;
    const W = this.width;
    const H = this.height;
    const point = this._tmpV2;
    let n = 0;

    for (let i = 0; i < labels.length; i++) {
      const L = labels[i];
      L.vis = false;
      const v = L.anchor(point);
      if (!v) {
        L.el.style.opacity = "0";
        L.line.setAttribute("opacity", "0");
        continue;
      }
      const p = this.project(v, this._proj || (this._proj = { x: 0, y: 0, visible: false }));
      if (!p.visible) {
        L.el.style.opacity = "0";
        L.line.setAttribute("opacity", "0");
        continue;
      }
      if (!L.w) {
        L.w = L.el.offsetWidth || 100;
        L.h = L.el.offsetHeight || 24;
      }
      const dist = L.distance;
      L.x = p.x + (L.offset[0] || 0) * dist;
      L.y = p.y + (L.offset[1] || -1) * dist;
      L.ax = p.x;
      L.ay = p.y;
      L.vis = true;
      n++;
    }

    /* push apart along the line between the two boxes */
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 0; i < labels.length; i++) {
        const a = labels[i];
        if (!a.vis) continue;
        for (let j = i + 1; j < labels.length; j++) {
          const b = labels[j];
          if (!b.vis) continue;
          const gapX = (a.w + b.w) / 2 + 10;
          const gapY = (a.h + b.h) / 2 + 8;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if (Math.abs(dx) >= gapX || Math.abs(dy) >= gapY) continue;
          moved = true;
          const pushX = (gapX - Math.abs(dx)) * 0.5 + 0.5;
          const pushY = (gapY - Math.abs(dy)) * 0.5 + 0.5;
          let sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
          let sy = dy === 0 ? (i % 2 ? 1 : -1) : dy > 0 ? 1 : -1;
          /* separate along the cheaper axis */
          if (pushX < pushY) {
            a.x -= sx * pushX;
            b.x += sx * pushX;
          } else {
            a.y -= sy * pushY;
            b.y += sy * pushY;
          }
        }
      }
      if (!moved) break;
    }

    for (let i = 0; i < labels.length; i++) {
      const L = labels[i];
      if (!L.vis) continue;
      L.x = clamp(L.x, L.w / 2 + 6, W - L.w / 2 - 6);
      L.y = clamp(L.y, L.h / 2 + 6, H - L.h / 2 - 6);
      L.el.style.opacity = "1";
      L.el.style.transform =
        "translate3d(" + Math.round(L.x) + "px," + Math.round(L.y) + "px,0) translate(-50%,-50%)";
      L.line.setAttribute("x1", L.ax.toFixed(1));
      L.line.setAttribute("y1", L.ay.toFixed(1));
      L.line.setAttribute("x2", L.x.toFixed(1));
      L.line.setAttribute("y2", (L.y + (L.offset[1] < 0 ? L.h / 2 : -L.h / 2)).toFixed(1));
      L.line.setAttribute("opacity", "1");
    }
  }

  setLabelTone(id, tone) {
    for (let i = 0; i < this._labels.length; i++) {
      if (this._labels[i].id !== id) continue;
      this._labels[i].el.dataset.tone = tone || "";
    }
  }

  /* ---------------------------------------------------------------- */
  /* HUD: fps/backend (F), quality note                                */
  /* ---------------------------------------------------------------- */

  _buildHud() {
    const hud = document.createElement("div");
    hud.className = "lab-hud";

    const fps = document.createElement("div");
    fps.className = "lab-fps";
    fps.dataset.on = "0";
    hud.appendChild(fps);

    const note = document.createElement("div");
    note.className = "lab-quality-note";
    note.dataset.on = "0";
    hud.appendChild(note);

    this.overlay.appendChild(hud);
    this.hudFps = fps;
    this.hudQuality = note;

    window.addEventListener("keydown", (e) => {
      if (e.key !== "f" && e.key !== "F") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const on = fps.dataset.on === "1";
      fps.dataset.on = on ? "0" : "1";
      fps.textContent = this.fps + " fps · " + this.backend;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Colour probe (pixel-sampling check)                               */
  /* ---------------------------------------------------------------- */

  showColourProbe(colours) {
    const names = colours || [
      PALETTE.gold,
      PALETTE.amber,
      PALETTE.teal,
      PALETTE.blue,
      PALETTE.green,
      PALETTE.red
    ];
    this._probe = [];

    names.forEach((hex, i) => {
      const geo = new PlaneGeometry(1, 1);
      const mat = new MeshBasicMaterial({
        color: new Color(hex),
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        transparent: false
      });
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = 1000;
      this.camera.add(mesh);
      this._probe.push({ hex: hex, mesh: mesh, u: 0.12 + i * 0.15, v: 0.16, w: 0.11, h: 0.09 });
    });
    this.scene.add(this.camera);
    this._layoutProbe();
    return this._probe;
  }

  /* Position the swatches in camera space for the current size/aspect. */
  _layoutProbe() {
    if (!this._probe) return;
    const halfH = Math.tan((this.camera.fov * DEG) / 2);
    const halfW = halfH * this.camera.aspect;
    for (const p of this._probe) {
      p.mesh.position.set((p.u - 0.5) * 2 * halfW, (0.5 - p.v) * 2 * halfH, -1);
      p.mesh.scale.set(p.w * 2 * halfW, p.h * 2 * halfH, 1);
    }
  }
}
