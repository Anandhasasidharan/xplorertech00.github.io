import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Verification for the WebGPU Lab.
 *
 * Modes:
 *   1. default            - WebGPU if the browser has it, else Canvas2D
 *   2. webgpu-forced-off  - navigator.gpu removed, Canvas2D fallback must work
 *   3. mobile width       - 390px
 *   4. reduced motion     - prefers-reduced-motion: reduce
 *
 * In headless environments a WebGPU canvas is often not composited, so the
 * script also renders the scene OFFSCREEN on the GPU and reads the pixels
 * back. That proves the WebGPU pipeline really draws geometry.
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:4000";
const LAB = `${BASE}/xplorertech00.github.io/webgpu-lab`;
// The curated screenshots in webgpu-lab/docs/ are produced by capture.mjs;
// the verification run keeps its own throwaway copies.
const OUT = process.env.OUT_DIR || resolve(tmpdir(), "webgpu-lab-verify");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "lab-index", url: `${LAB}/` },
  { name: "gatekeeper", url: `${LAB}/gatekeeper/` },
  { name: "delegation-tree", url: `${LAB}/delegation-tree/` }
];

const GPU_OFF_ARGS = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan"];

async function run(label, { disableWebGPU, reducedMotion, viewport, tag }) {
  console.log(`\n=== ${label} ===`);
  const browser = await chromium.launch({ args: GPU_OFF_ARGS });
  const context = await browser.newContext({
    viewport: viewport || { width: 1280, height: 900 },
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    deviceScaleFactor: 1
  });
  if (disableWebGPU) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
    });
  }
  const results = [];
  for (const p of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    const resp = await page.goto(p.url, { waitUntil: "load" });
    await page.waitForTimeout(1400);
    const status = resp ? resp.status() : 0;

    const info = await page.evaluate(async () => {
      const banner = document.getElementById("fallback-banner");
      const fallback = !!(banner && banner.style.display === "block");
      const out = { fallback, gpuSupported: typeof navigator !== "undefined" && !!navigator.gpu };
      // shader compilation + offscreen GPU render check
      if (typeof WebGPULab !== "undefined" && WebGPULab.isSupported() && !fallback) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          const device = await adapter.requestDevice();
          const module = device.createShaderModule({
            code: WebGPULab.shaders.vertex + "\n" + WebGPULab.shaders.fragment
          });
          const info = await module.getCompilationInfo();
          out.shaderMessages = info.messages.map((m) => `${m.type}: ${m.message}`);
          device.pushErrorScope("validation");
          const canvas = document.createElement("canvas");
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext("webgpu");
          const format = navigator.gpu.getPreferredCanvasFormat();
          ctx.configure({ device, format, alphaMode: "premultiplied" });
          out.format = format;
          const err = await device.popErrorScope();
          out.validationError = err ? err.message : null;
        } catch (e) {
          out.gpuProbeError = String(e);
        }
      }
      // GPU path proof: render the real scene offscreen and read it back.
      if (typeof window !== "undefined" && window.__lab && window.__lab.stage &&
          typeof window.__lab.stage.renderToPixels === "function") {
        try {
          const prims = window.__lab.scene();
          const stats = await window.__lab.stage.renderToPixels(prims, 320, 320);
          out.gpuScene = stats;
        } catch (e) {
          out.gpuSceneError = String(e);
        }
      }
      // does the demo actually draw pixels (works for both renderers)?
      const canvas = document.getElementById("stage");
      if (canvas) {
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const c2 = tmp.getContext("2d");
        c2.drawImage(canvas, 0, 0);
        const data = c2.getImageData(0, 0, tmp.width, tmp.height).data;
        let lit = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
        out.litPixels = lit;
        out.canvasSize = [canvas.width, canvas.height];
      }
      return out;
    });

    // keyboard reachability + the key interactions
    const interactions = {};
    if (p.name === "gatekeeper") {
      interactions.callButtons = await page.locator("#calls button").count();
      interactions.countersPresent = (await page.locator("#c-allowed").count()) > 0;
      await page.locator("#calls button").first().click();
      interactions.detailAfterClick = (await page.locator("#detail .kv").count()) > 0;
      await page.locator("canvas#stage").focus();
      await page.keyboard.press("ArrowRight");
      interactions.liveRegion = await page.locator("#live").textContent();
    }
    if (p.name === "delegation-tree") {
      interactions.nodeButtons = await page.locator("#nodes button").count();
      interactions.replay = await page.locator("#replay").count();
      interactions.speed = await page.locator("#speed").count();
      interactions.labels = await page.locator(".node-label").count();
      await page.locator("#widen").click();
      interactions.widenVerdict = (await page.locator("#verdict").textContent() || "").trim().slice(0, 140);
      interactions.rejected = await page.locator("#verdict.rejected").count();
      await page.locator("#narrow").click();
      interactions.narrowVerdict = (await page.locator("#verdict").textContent() || "").trim().slice(0, 140);
      interactions.issued = await page.locator("#verdict.issued").count();
    }

    const shot = `${OUT}/${p.name}${tag}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ page: p.name, status, errors, info, interactions, shot });
    console.log(
      `${p.name}: http ${status} | errors ${errors.length}` +
        `${errors.length ? " -> " + errors.join(" || ") : ""}` +
        ` | fallback ${info.fallback} | lit pixels ${info.litPixels}` +
        `${info.gpuScene ? " | GPU offscreen lit " + info.gpuScene.nonZero + "/" + info.gpuScene.width + "x" + info.gpuScene.height : ""}` +
        `${info.gpuSceneError ? " | GPU SCENE ERROR " + info.gpuSceneError : ""}` +
        `${info.shaderMessages && info.shaderMessages.length ? " | SHADER " + info.shaderMessages.join(";") : ""}` +
        `${info.validationError ? " | VALIDATION " + info.validationError : ""}`
    );
    await page.close();
  }
  await browser.close();
  return results;
}

const all = [];
all.push(...(await run("Default (WebGPU when available)", { tag: "" })));
all.push(...(await run("WebGPU forced OFF - Canvas2D fallback", { disableWebGPU: true, tag: "-fallback" })));
all.push(...(await run("Mobile width 390px", { viewport: { width: 390, height: 844 }, tag: "-mobile" })));
all.push(...(await run("Reduced motion", { reducedMotion: true, tag: "-reduced" })));

console.log("\n================ SUMMARY ================");
const failures = [];
all.forEach((r) => {
  if (r.status !== 200) failures.push(`${r.page}: HTTP ${r.status}`);
  if (r.errors.length) failures.push(`${r.page}: console errors ${r.errors.join(" | ")}`);
  if (r.info && r.info.shaderMessages && r.info.shaderMessages.length) failures.push(`${r.page}: shader messages`);
  if (r.info && r.info.validationError) failures.push(`${r.page}: ${r.info.validationError}`);
  if (r.info && r.info.gpuScene && r.info.gpuScene.nonZero === 0) failures.push(`${r.page}: GPU path drew nothing`);
  if (r.info && r.info.gpuSceneError) failures.push(`${r.page}: GPU scene error ${r.info.gpuSceneError}`);
  if (r.info && r.info.litPixels === 0 && r.info.fallback && r.page !== "lab-index") failures.push(`${r.page}: Canvas2D fallback drew nothing`);
  if (r.page === "gatekeeper" && r.interactions.callButtons === 0) failures.push("gatekeeper: call list is empty");
  if (r.page === "delegation-tree" && !r.interactions.rejected) failures.push("delegation-tree: widening attempt was not rejected");
  if (r.page === "delegation-tree" && !r.interactions.issued) failures.push("delegation-tree: valid narrowing was not issued");
  if (r.page === "delegation-tree" && r.interactions.labels < 5) failures.push("delegation-tree: node labels missing");
  if (r.page === "delegation-tree" && !r.interactions.replay) failures.push("delegation-tree: replay control missing");
  if (r.page === "delegation-tree" && !r.interactions.speed) failures.push("delegation-tree: speed control missing");
});
if (!failures.length) console.log("All checks passed: HTTP 200, no console errors, scenes drawn, interactions behave.");
else failures.forEach((f) => console.log("FAIL " + f));
process.exit(failures.length ? 1 : 0);
