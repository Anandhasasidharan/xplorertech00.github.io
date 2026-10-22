import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Captures the screenshots in webgpu-lab/docs/.
 *
 * Headless browsers do not composite a WebGPU canvas, so the scene is
 * captured through the Canvas2D fallback (same scene, same data). The
 * verification script proves the GPU path separately by rendering the scene
 * offscreen and reading the pixels back.
 *
 *   node webgpu-lab/capture.mjs
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:4000";
const LAB = `${BASE}/xplorertech00.github.io/webgpu-lab`;
const OUT = resolve(process.cwd(), "webgpu-lab/docs");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan"]
});

async function page(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
  });
  const p = await context.newPage();
  return { p, context };
}

// landing page
{
  const { p, context } = await page({ width: 1280, height: 1000 });
  await p.goto(`${LAB}/`, { waitUntil: "load" });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/lab-index.png` });
  await context.close();
}

// gatekeeper: the scene with a call pinned in the side panel
{
  const { p, context } = await page({ width: 1280, height: 1100 });
  await p.goto(`${LAB}/gatekeeper/`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.locator("#calls button").nth(3).click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/gatekeeper-fallback.png` });
  await context.close();
}

// gatekeeper on a phone
{
  const { p, context } = await page({ width: 390, height: 844 });
  await p.goto(`${LAB}/gatekeeper/`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/gatekeeper-mobile.png` });
  await context.close();
}

// delegation tree: a rejected widening, then an accepted narrowing
{
  const { p, context } = await page({ width: 1280, height: 1100 });
  await p.goto(`${LAB}/delegation-tree/`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.locator("#widen").click();
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/delegation-tree-fallback.png` });
  await p.locator("#narrow").click();
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/delegation-tree-narrowing.png` });
  await context.close();
}

// delegation tree on a phone
{
  const { p, context } = await page({ width: 390, height: 844 });
  await p.goto(`${LAB}/delegation-tree/`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/delegation-tree-mobile.png` });
  await context.close();
}

await browser.close();
console.log("screenshots written to", OUT);
