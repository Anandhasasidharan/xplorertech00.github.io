#!/usr/bin/env node
/**
 * Captures the screenshots in webgpu-lab/docs/.
 *
 *   node webgpu-lab/capture.mjs        (needs playwright + a server on :4000)
 *
 * Every shot is taken with the WebGL 2 backend (?backend=webgl). Headless
 * Chromium does not composite a WebGPU canvas into a screenshot, so the WebGPU
 * path cannot be captured this way — see README "Known limitations". The
 * WebGPU backend is still exercised by verify.mjs.
 *
 * Output:
 *   docs/gatekeeper-webgl.png              default scene, calls passing
 *   docs/gatekeeper-blocked-webgl.png      a blocked call breaking apart
 *   docs/gatekeeper-mobile-webgl.png       390px width
 *   docs/delegation-tree-webgl.png          nested shells + token flow
 *   docs/delegation-tree-rejection-webgl.png  the widening rejection
 *   docs/delegation-tree-mobile-webgl.png   390px width
 *   docs/lab-index.png                     landing page
 *   docs/gatekeeper-webgl.jpg              still used by the no-GPU fallback
 *   docs/delegation-tree-webgl.jpg         still used by the no-GPU fallback
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4000/xplorertech00.github.io/webgpu-lab";
const OUT = process.env.OUT_DIR || resolve(process.cwd(), "webgpu-lab/docs");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan"]
});

async function stageShot(page, file, opts) {
  /* locator.screenshot scrolls the stage into view first */
  await page.locator(".stage-wrap").screenshot({ path: resolve(OUT, file), ...opts });
  console.log("captured", file);
}

/* Gatekeeper: default scene, then a blocked call, then mobile */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/gatekeeper/?backend=webgl&quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__lab && window.__lab.lab.ready), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await stageShot(page, "gatekeeper-webgl.png");
  await stageShot(page, "gatekeeper-webgl.jpg", { type: "jpeg", quality: 62 });

  await page.evaluate(() => {
    window.__lab.lab.speed = 3;
  });
  await page.waitForFunction(() => window.__lab.counters().blocked > 0, null, { timeout: 40000 });
  await stageShot(page, "gatekeeper-blocked-webgl.png");
  await ctx.close();
}

/* Delegation: mid-flow, then the rejection */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/delegation-tree/?backend=webgl&quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__lab && window.__lab.lab.ready), null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await stageShot(page, "delegation-tree-webgl.png");
  await stageShot(page, "delegation-tree-webgl.jpg", { type: "jpeg", quality: 62 });

  await page.evaluate(() => window.__lab.tryWiden());
  await page.waitForFunction(() => document.getElementById("verdict").className.includes("show"), null, { timeout: 20000 });
  await page.waitForTimeout(120);
  await stageShot(page, "delegation-tree-rejection-webgl.png");
  await ctx.close();
}

/* Mobile width */
for (const [id, path] of [
  ["gatekeeper", "gatekeeper/"],
  ["delegation-tree", "delegation-tree/"]
]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${path}?backend=webgl&quality=low`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__lab && window.__lab.lab.ready), null, { timeout: 30000 });
  await page.waitForTimeout(2200);
  await stageShot(page, `${id}-mobile-webgl.png`);
  await ctx.close();
}

/* Landing page */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(OUT, "lab-index.png"), fullPage: false });
  console.log("captured lab-index.png");
  await ctx.close();
}

await browser.close();
console.log("\nshots written to " + OUT);
