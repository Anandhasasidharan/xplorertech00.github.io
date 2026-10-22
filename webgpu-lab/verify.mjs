#!/usr/bin/env node
/**
 * Verification for the Three.js Lab.
 *
 *   node webgpu-lab/verify.mjs            (needs playwright + a server on :4000)
 *   BASE=... OUT_DIR=... node webgpu-lab/verify.mjs
 *
 * For each demo it loads the page with the default backend and with
 * ?backend=webgl, in four modes — default, 390px, reduced motion, and Low
 * quality — and checks:
 *
 *   - HTTP 200, a Three.js canvas, the expected backend label
 *   - zero console errors / page errors
 *   - no horizontal overflow and no label outside the canvas
 *   - no overlapping labels
 *   - reduced motion starts paused
 *
 * Then it samples palette colours from a screenshot (the white-clamping bug
 * this guards against), exercises the two delegation buttons, presses F for
 * the fps/backend readout, and reports page sizes and indicative heap growth.
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4000/xplorertech00.github.io/webgpu-lab";
const OUT = process.env.OUT_DIR || resolve(tmpdir(), "webgpu-lab-verify");
mkdirSync(OUT, { recursive: true });

const PALETTE = {
  gold: "#d8b56c",
  amber: "#e29e4a",
  teal: "#42a69c",
  blue: "#5285c7",
  green: "#39ff88",
  red: "#ff5968"
};

const DEMOS = [
  { id: "gatekeeper", path: "gatekeeper/", label: "Gatekeeper" },
  { id: "delegation-tree", path: "delegation-tree/", label: "Delegation Tree" }
];

const MODES = [
  { id: "default", query: "", ctx: { viewport: { width: 1280, height: 900 } } },
  {
    id: "mobile-390",
    query: "",
    ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
  },
  { id: "reduced-motion", query: "", ctx: { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" } },
  { id: "low-quality", query: "&quality=low", ctx: { viewport: { width: 1280, height: 900 } } }
];

const BACKENDS = [
  { id: "auto", param: "", expect: null },
  { id: "webgl", param: "&backend=webgl", expect: "WebGL 2" }
];

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan"]
});

const results = [];
let failures = 0;

function fail(run, message) {
  run.problems.push(message);
}

for (const demo of DEMOS) {
  for (const backend of BACKENDS) {
    for (const mode of MODES) {
      const ctx = await browser.newContext(mode.ctx);
      const page = await ctx.newPage();
      const run = { demo: demo.id, backend: backend.id, mode: mode.id, problems: [] };
      const errors = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 200));
      });
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));

      const url = `${BASE}/${demo.path}?run=1${backend.param}${mode.query}`;
      const response = await page.goto(url, { waitUntil: "load" });
      if (!response || response.status() !== 200) fail(run, "HTTP " + (response && response.status()));

      await page
        .waitForFunction(() => Boolean(window.__lab && window.__lab.lab && window.__lab.lab.ready), null, { timeout: 30000 })
        .catch(() => fail(run, "lab did not become ready"));
      await page.waitForTimeout(1200);

      const state = await page.evaluate(() => {
        const lab = window.__lab && window.__lab.lab;
        if (!lab) return null;
        const stage = document.querySelector(".stage-wrap").getBoundingClientRect();
        const labels = [...document.querySelectorAll(".lab-label")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: el.textContent.trim().slice(0, 24),
            x: r.x, y: r.y, w: r.width, h: r.height,
            visible: getComputedStyle(el).opacity !== "0"
          };
        });
        return {
          backend: lab.backend,
          quality: lab.quality,
          playing: lab.playing,
          fps: lab.fps,
          stage: { x: stage.x, y: stage.y, w: stage.width, h: stage.height },
          labels,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      if (!state) fail(run, "no lab state");
      else {
        if (backend.expect && state.backend !== backend.expect) {
          fail(run, `backend reported ${state.backend}, expected ${backend.expect}`);
        }
        if (!state.backend) fail(run, "no backend label");
        if (state.overflow > 1) fail(run, `horizontal overflow ${state.overflow}px`);
        if (mode.id === "mobile-390" && state.quality !== "low") {
          fail(run, "narrow screen should default to Low quality");
        }
        if (mode.id === "low-quality" && state.quality !== "low") {
          fail(run, "?quality=low was ignored");
        }
        if (mode.id === "reduced-motion" && state.playing) {
          fail(run, "reduced motion should start paused");
        }

        const stage = state.stage;
        const visible = state.labels.filter((l) => l.visible);
        for (const l of visible) {
          if (l.x < stage.x - 1 || l.y < stage.y - 1 || l.x + l.w > stage.x + stage.w + 1 || l.y + l.h > stage.y + stage.h + 1) {
            fail(run, `label "${l.text}" outside the canvas`);
          }
        }
        for (let i = 0; i < visible.length; i++) {
          for (let j = i + 1; j < visible.length; j++) {
            const a = visible[i];
            const b = visible[j];
            const dx = Math.abs(a.x + a.w / 2 - (b.x + b.w / 2));
            const dy = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2));
            if (dx < (a.w + b.w) / 2 - 1 && dy < (a.h + b.h) / 2 - 1) {
              fail(run, `labels "${a.text}" and "${b.text}" overlap`);
            }
          }
        }
      }

      if (errors.length) {
        for (const e of errors.slice(0, 3)) fail(run, "console: " + e);
      }

      run.fps = state && state.fps;
      run.backendName = state && state.backend;
      run.quality = state && state.quality;

      if (mode.id === "default") {
        const stageBox = await page.locator(".stage-wrap").boundingBox();
        if (stageBox) {
          const file = join(OUT, `${demo.id}-${backend.id}.png`);
          await page.screenshot({ path: file, clip: stageBox });
          run.screenshot = file;
        }
      }

      results.push(run);
      if (run.problems.length) failures++;
      await ctx.close();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Palette sampling (WebGL backend, bloom off, colour probe on)        */
/* ------------------------------------------------------------------ */

async function sampleColours(demo) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  const url = `${BASE}/${demo.path}?backend=webgl&quality=low&colortest=1`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__lab && window.__lab.lab && window.__lab.lab.ready), null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(900);
  const probe = await page.evaluate(() => {
    const lab = window.__lab.lab;
    const canvas = document.getElementById("stage").getBoundingClientRect();
    const stage = document.querySelector(".stage-wrap").getBoundingClientRect();
    return {
      probe: lab._probe.map((p) => {
        const world = p.mesh.getWorldPosition(p.mesh.position.clone());
        const screen = lab.project(world, { x: 0, y: 0, visible: true });
        return {
          hex: p.hex,
          x: screen.x + (canvas.x - stage.x),
          y: screen.y + (canvas.y - stage.y)
        };
      })
    };
  });
  const stageBox = await page.locator(".stage-wrap").boundingBox();
  const shot = await page.screenshot({ clip: stageBox });
  writeFileSync(join(OUT, `${demo.id}-colortest.png`), shot);
  const dataUrl = "data:image/png;base64," + shot.toString("base64");

  /* decode the screenshot in the browser and read swatch centres */
  const scratch = await ctx.newPage();
  const size = { width: stageBox.width, height: stageBox.height };
  const sampled = await scratch.evaluate(async ({ url, probe, PROBE_WIDTH, PROBE_HEIGHT }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const scaleX = img.width / PROBE_WIDTH;
    const scaleY = img.height / PROBE_HEIGHT;
    return probe.map((p) => {
      const d = g.getImageData(Math.round(p.x * scaleX), Math.round(p.y * scaleY), 1, 1).data;
      return { hex: p.hex, rgb: [d[0], d[1], d[2]] };
    });
  }, { url: dataUrl, probe: probe.probe, PROBE_WIDTH: size.width, PROBE_HEIGHT: size.height });
  await ctx.close();

  const report = sampled.map((s) => {
    const want = [parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16)];
    const delta = Math.max(...want.map((v, i) => Math.abs(v - s.rgb[i])));
    return { hex: s.hex, got: s.rgb, delta };
  });
  return { report, errors };
}

/* ------------------------------------------------------------------ */
/* Interaction + heap                                                  */
/* ------------------------------------------------------------------ */

async function interactions() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`${BASE}/delegation-tree/?backend=webgl&quality=low`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__lab), null, { timeout: 30000 });

  await page.evaluate(() => window.__lab.tryWiden());
  await page.waitForFunction(() => document.getElementById("verdict").className.includes("show"), null, { timeout: 15000 })
    .catch(() => {});
  const rejected = await page.locator("#verdict").innerText();
  if (!/Rejected/.test(rejected)) errors.push("widening attempt was not rejected: " + rejected.slice(0, 80));

  await page.evaluate(() => window.__lab.tryNarrow());
  const issued = await page.locator("#verdict").innerText();
  if (!/Issued/.test(issued)) errors.push("valid narrowing was not issued: " + issued.slice(0, 80));

  const heapBefore = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));
  await page.waitForTimeout(4000);
  const heapAfter = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));

  await page.keyboard.press("f");
  const hud = await page.evaluate(() => {
    const el = document.querySelector(".lab-fps");
    return { on: el.dataset.on, text: el.textContent };
  });
  if (hud.on !== "1" || !/fps/.test(hud.text)) errors.push("F did not reveal the fps/backend label");

  await ctx.close();
  return { rejected, issued, hud, heapDeltaKb: Math.round((heapAfter - heapBefore) / 1024), errors };
}

/* ------------------------------------------------------------------ */
/* No-GPU fallback: no WebGPU and no WebGL 2                           */
/* ------------------------------------------------------------------ */

async function fallback() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
    } catch (err) {
      /* ignore */
    }
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === "webgl2" || type === "webgl" || type === "webgpu") return null;
      return original.call(this, type, ...rest);
    };
  });
  const out = [];
  for (const demo of DEMOS) {
    const errors = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
    await page.goto(`${BASE}/${demo.path}?backend=webgl`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const el = document.getElementById("no-gpu");
      const img = el && el.querySelector("img");
      return {
        shown: el && el.dataset.on === "1",
        hasImg: Boolean(img),
        imgIsData: Boolean(img && img.src.startsWith("data:image/")),
        message: el ? el.textContent.trim().slice(0, 60) : ""
      };
    });
    out.push({ demo: demo.id, ...state, errors });
    if (!state.shown || !state.hasImg || !state.imgIsData || errors.length) out[out.length - 1].bad = true;
  }
  await ctx.close();
  return out;
}

/* ------------------------------------------------------------------ */

const colourChecks = [];
for (const demo of DEMOS) colourChecks.push({ demo: demo.id, ...(await sampleColours(demo)) });
const interact = await interactions();
const fallbackChecks = await fallback();

await browser.close();

/* ------------------------------------------------------------------ */
/* Report                                                             */
/* ------------------------------------------------------------------ */

console.log("=== modes ===");
for (const r of results) {
  console.log(
    [
      r.demo.padEnd(16),
      r.backend.padEnd(6),
      r.mode.padEnd(14),
      (r.backendName || "?").padEnd(8),
      "q:" + (r.quality || "?"),
      "fps:" + (r.fps || 0),
      r.problems.length ? "FAIL" : "ok"
    ].join(" ")
  );
  for (const p of r.problems) console.log("   - " + p);
}

console.log("\n=== palette sampling (WebGL 2, bloom off) ===");
for (const c of colourChecks) {
  const bad = c.report.filter((r) => r.delta > 3);
  console.log(
    `${c.demo}: ` +
      c.report.map((r) => `${r.hex}->${r.got.join(",")}${r.delta > 3 ? " (delta " + r.delta + ")" : ""}`).join("  ")
  );
  if (bad.length || c.errors.length) failures++;
}

console.log("\n=== no-GPU fallback (screenshot + message) ===");
for (const f of fallbackChecks) {
  console.log(`${f.demo}: shown=${f.shown} screenshot=${f.hasImg && f.imgIsData} "${f.message}"`);
  if (f.bad) failures++;
}

console.log("\n=== interaction ===");
console.log("widen  :", interact.rejected.split("\n")[0].slice(0, 90));
console.log("narrow :", interact.issued.split("\n")[0].slice(0, 90));
console.log("F hud  :", JSON.stringify(interact.hud));
console.log("heap   : " + interact.heapDeltaKb + " kB growth over 4 s (indicative)");
if (interact.errors.length) {
  failures++;
  for (const e of interact.errors) console.log("   - " + e);
}

console.log("\n=== summary ===");
console.log(results.length + " page loads, failures: " + failures);
console.log("screenshots:", OUT);
process.exit(failures ? 1 : 0);
