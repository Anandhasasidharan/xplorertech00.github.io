#!/usr/bin/env node
/**
 * webgpu-lab build step
 *
 * Each demo ships as ONE self-contained HTML file: inline CSS, inline JS, and
 * the Three.js modules bundled (tree-shaken, minified) and inlined. Nothing is
 * fetched at runtime — no CDN, no external requests, no import maps.
 *
 *   npm install        (once)
 *   npm run build      (or: node webgpu-lab/build.mjs)
 *
 * Templates live in webgpu-lab/src/*.html and contain markers:
 *
 *   <!--BUNDLE:gatekeeper.js-->   inline the esbuild bundle of that entry
 *   <!--IMAGE:docs/x.jpg-->       inline the file as a data URI (fallback still)
 *
 * Sources for the demos live in webgpu-lab/src/*.js and webgpu-lab/shared/.
 * Never hand-edit the built pages.
 *
 * Output:
 *   webgpu-lab/index.html
 *   webgpu-lab/gatekeeper/index.html
 *   webgpu-lab/delegation-tree/index.html
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync, transformSync } from "esbuild";
import { liquidSafeJs, findLiquidSequences } from "./tools/liquid-safe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(here);
const srcDir = join(labRoot, "src");

const TARGETS = [
  { template: "index.html", output: join(labRoot, "index.html"), bundle: null },
  { template: "gatekeeper.html", output: join(labRoot, "gatekeeper", "index.html"), bundle: "gatekeeper.js" },
  { template: "delegation-tree.html", output: join(labRoot, "delegation-tree", "index.html"), bundle: "delegation-tree.js" }
];

/* ------------------------------------------------------------------ */
/* Bundling                                                           */
/* ------------------------------------------------------------------ */

function bundle(entry) {
  const result = buildSync({
    entryPoints: [join(srcDir, entry)],
    bundle: true,
    format: "iife",
    target: ["es2020"],
    minify: true,
    write: false,
    legalComments: "none",
    logLevel: "warning"
  });
  return result.outputFiles[0].text;
}

/* ------------------------------------------------------------------ */
/* Liquid safety                                                      */
/* ------------------------------------------------------------------ */

function assertNoLiquid(text, label) {
  const problems = findLiquidSequences(text);
  if (problems.length) {
    throw new Error(`${label} contains Liquid-like sequences: ${problems.join(", ")}`);
  }
  if (/^\s*---\s*$/m.test(text.split("\n").slice(0, 6).join("\n"))) {
    throw new Error(`${label} looks like it has Jekyll front matter`);
  }
}

/* ------------------------------------------------------------------ */
/* Inlining                                                           */
/* ------------------------------------------------------------------ */

function inlineImages(html) {
  return html.replace(/<!--IMAGE:([^>]+?)-->/g, (_m, relPath) => {
    const file = join(labRoot, relPath.trim());
    if (!existsSync(file)) {
      return '<!-- fallback screenshot not captured yet: ' + relPath.trim() + " -->";
    }
    const data = readFileSync(file).toString("base64");
    const ext = file.endsWith(".png") ? "png" : "jpeg";
    return `<img src="data:image/${ext};base64,${data}" alt="Still frame of the rendered demo, taken from the WebGL 2 backend." />`;
  });
}

function inlineBundle(html, entry) {
  const marker = `<!--BUNDLE:${entry}-->`;
  if (!html.includes(marker)) throw new Error(`missing marker ${marker}`);
  let js = bundle(entry);
  const before = (js.match(/\}\}|\{\{|\{%|%\}/g) || []).length;
  js = liquidSafeJs(js);
  if (before) console.log(`  ${entry}: neutralised ${before} Liquid-like sequence(s) in the bundle`);
  /* syntax gate: re-parse the transformed bundle */
  try {
    transformSync(js, { minify: false, loader: "js" });
  } catch (err) {
    throw new Error(`bundled ${entry} does not parse after Liquid escaping: ${err.message}`);
  }
  return html.replace(marker, `<script>\n${js}\n</script>`);
}

/* ------------------------------------------------------------------ */
/* Build                                                              */
/* ------------------------------------------------------------------ */

let built = 0;
let total = 0;

for (const target of TARGETS) {
  const templatePath = join(srcDir, target.template);
  let html = readFileSync(templatePath, "utf8");
  assertNoLiquid(html, target.template);

  html = inlineImages(html);
  if (target.bundle) html = inlineBundle(html, target.bundle);

  assertNoLiquid(html, target.template + " (built)");

  mkdirSync(dirname(target.output), { recursive: true });
  writeFileSync(target.output, html);

  const kb = Buffer.byteLength(html) / 1024;
  total += kb;
  console.log(`built ${target.output.replace(labRoot + "/", "").padEnd(30)} ${kb.toFixed(1)} kB`);
  built++;
}

const three = JSON.parse(readFileSync(join(labRoot, "node_modules/three/package.json"), "utf8")).version;
console.log(`\n${built} pages built with three ${three}.`);
console.log("Open webgpu-lab/index.html, or run: python3 -m http.server -d webgpu-lab");
