import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Captures the screenshots in webgpu-lab/docs/.
 *
 * Headless browsers do not composite a WebGPU canvas into a screenshot, so
 * two kinds of image are produced:
 *
 *   *-fallback.png  the Canvas2D renderer (WebGPU forced off)
 *   *.png           REAL WebGPU output: the scene is rendered on the GPU into
 *                   an offscreen texture, the pixels are read back and painted
 *                   into a 2D canvas, which is then screenshotted
 *
 * The verification script (verify.mjs) proves the same path independently.
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:4000";
const LAB = `${BASE}/xplorertech00.github.io/webgpu-lab`;
const OUT = process.env.OUT_DIR || resolve(process.cwd(), "webgpu-lab/docs");
mkdirSync(OUT, { recursive: true });

const GPU_ARGS = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan"];

async function newPage(browser, { width, height, webgpu }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (!webgpu) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
    });
  }
  const page = await context.newPage();
  return { page, context };
}

/** Renders the live scene on the GPU and paints the result into a 2D canvas. */
async function gpuSnapshot(page) {
  return page.evaluate(async () => {
    const lab = window.__lab;
    if (!lab || !lab.stage || typeof lab.stage.renderToPixels !== "function") return null;
    const canvas = document.getElementById("stage");
    const w = canvas.width;
    const h = canvas.height;
    const stats = await lab.stage.renderToPixels(lab.scene(), w, h, { withPixels: true });
    if (!stats || !stats.pixels) return null;
    const binary = atob(stats.pixels);
    const rgba = new Uint8ClampedArray(binary.length);
    for (let i = 0; i < binary.length; i++) rgba[i] = binary.charCodeAt(i);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.id = "gpu-snapshot";
    const ctx = out.getContext("2d");
    ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    document.body.appendChild(out);
    return { lit: stats.nonZero, width: w, height: h };
  });
}

// ── landing page (no canvas) ────────────────────────────────────────────
{
  const browser = await chromium.launch({ args: GPU_ARGS });
  const { page, context } = await newPage(browser, { width: 1280, height: 1000, webgpu: false });
  await page.goto(`${LAB}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/lab-index.png` });
  await context.close();
  await browser.close();
}

// ── gatekeeper ──────────────────────────────────────────────────────────
{
  const browser = await chromium.launch({ args: GPU_ARGS });
  const { page, context } = await newPage(browser, { width: 1280, height: 1100, webgpu: false });
  await page.goto(`${LAB}/gatekeeper/`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await page.locator("#calls button").nth(3).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/gatekeeper-fallback.png` });
  await context.close();

  const { page: gpuPage, context: gpuCtx } = await newPage(browser, { width: 1280, height: 1100, webgpu: true });
  await gpuPage.goto(`${LAB}/gatekeeper/`, { waitUntil: "load" });
  await gpuPage.waitForTimeout(1600);
  const info = await gpuSnapshot(gpuPage);
  console.log("gatekeeper GPU readback:", JSON.stringify(info));
  await gpuPage.locator("#gpu-snapshot").screenshot({ path: `${OUT}/gatekeeper-webgpu.png` });
  await gpuCtx.close();
  await browser.close();
}

// ── delegation tree ─────────────────────────────────────────────────────
{
  const browser = await chromium.launch({ args: GPU_ARGS });
  const { page, context } = await newPage(browser, { width: 1280, height: 1100, webgpu: false });
  await page.goto(`${LAB}/delegation-tree/`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.locator("#nodes button").nth(2).click();
  await page.click("#widen");
  await page.waitForTimeout(140);
  await page.locator(".stage-wrap").screenshot({ path: `${OUT}/delegation-tree-fallback.png` });
  await page.click("#narrow");
  await page.waitForTimeout(400);
  await page.locator(".stage-wrap").screenshot({ path: `${OUT}/delegation-tree-narrowing.png` });
  await context.close();

  const { page: gpuPage, context: gpuCtx } = await newPage(browser, { width: 1280, height: 1100, webgpu: true });
  await gpuPage.goto(`${LAB}/delegation-tree/`, { waitUntil: "load" });
  await gpuPage.waitForTimeout(1800);
  const info = await gpuSnapshot(gpuPage);
  console.log("delegation-tree GPU readback:", JSON.stringify(info));
  await gpuPage.locator("#gpu-snapshot").screenshot({ path: `${OUT}/delegation-tree-webgpu.png` });
  await gpuCtx.close();
  await browser.close();
}

// ── mobile ──────────────────────────────────────────────────────────────
{
  const browser = await chromium.launch({ args: GPU_ARGS });
  // element screenshots: a headless viewport capture can grab a stale,
  // unpainted canvas layer
  const { page, context } = await newPage(browser, { width: 390, height: 844, webgpu: false });
  await page.goto(`${LAB}/delegation-tree/`, { waitUntil: "load" });
  await page.waitForTimeout(1600);
  await page.locator(".stage-wrap").screenshot({ path: `${OUT}/delegation-tree-mobile.png` });
  await context.close();

  const { page: gatePage, context: gateCtx } = await newPage(browser, { width: 390, height: 844, webgpu: false });
  await gatePage.goto(`${LAB}/gatekeeper/`, { waitUntil: "load" });
  await gatePage.waitForTimeout(1600);
  await gatePage.locator(".stage-wrap").screenshot({ path: `${OUT}/gatekeeper-mobile.png` });
  await gateCtx.close();
  await browser.close();
}

console.log("screenshots written to", OUT);
