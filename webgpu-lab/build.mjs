#!/usr/bin/env node
/**
 * webgpu-lab build step
 *
 * Each demo must ship as ONE self-contained HTML file: inline CSS, inline JS,
 * and the shared modules (shared/gpu.js, shared/data.js) inlined rather than
 * fetched. This script does that inlining.
 *
 *   node webgpu-lab/build.mjs
 *
 * Templates live in webgpu-lab/src/*.html and contain markers:
 *   <!--INLINE:shared/gpu.js-->
 *   <!--INLINE:shared/data.js-->
 *
 * Output:
 *   webgpu-lab/index.html
 *   webgpu-lab/gatekeeper/index.html
 *   webgpu-lab/delegation-tree/index.html
 *
 * No dependencies - plain Node, nothing to install.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(here);
const srcDir = join(labRoot, "src");

const TARGETS = [
  { template: "index.html", output: join(labRoot, "index.html") },
  { template: "gatekeeper.html", output: join(labRoot, "gatekeeper", "index.html") },
  { template: "delegation-tree.html", output: join(labRoot, "delegation-tree", "index.html") }
];

const INLINE_RE = /<!--INLINE:([^>]+?)-->/g;

function inlineModules(html, templatePath) {
  return html.replace(INLINE_RE, (_match, relPath) => {
    const modulePath = join(labRoot, relPath.trim());
    let code = readFileSync(modulePath, "utf8");
    // never let a closing script tag inside the module break the page
    code = code.replace(/<\/script/gi, "<\\/script");
    // Liquid is not processed in these files, but keep the output free of the
    // sequences Jekyll/Liquid would react to.
    code = code.replace(/\{\{/g, "{ {").replace(/\}\}/g, "} }").replace(/\{%/g, "{ %").replace(/%\}/g, "% }");
    return `<script>\n/* ---- inlined: ${relPath.trim()} ---- */\n${code}\n</script>`;
  });
}

function assertNoLiquid(text, label) {
  const problems = [];
  if (/\{\{/.test(text)) problems.push("{{");
  if (/\}\}/.test(text)) problems.push("}}");
  if (/\{%/.test(text)) problems.push("{%");
  if (/%\}/.test(text)) problems.push("%}");
  if (problems.length) {
    throw new Error(`${label} contains Liquid-like sequences: ${problems.join(", ")}`);
  }
  if (/^\s*---\s*$/m.test(text.split("\n").slice(0, 6).join("\n"))) {
    throw new Error(`${label} looks like it has Jekyll front matter`);
  }
}

let built = 0;
for (const target of TARGETS) {
  const templatePath = join(srcDir, target.template);
  const raw = readFileSync(templatePath, "utf8");
  assertNoLiquid(raw, target.template);
  const out = inlineModules(raw, templatePath);
  assertNoLiquid(out, target.template + " (built)");
  mkdirSync(dirname(target.output), { recursive: true });
  writeFileSync(target.output, out);
  const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
  console.log(`built ${target.output.replace(labRoot + "/", "")} (${kb} kB)`);
  built++;
}
console.log(`\n${built} pages built. Open webgpu-lab/index.html or run: python3 -m http.server -d webgpu-lab`);
