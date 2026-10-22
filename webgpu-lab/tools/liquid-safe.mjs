/* ---------------------------------------------------------------------------
 * webgpu-lab / tools/liquid-safe.mjs
 *
 * The built pages carry an inlined JavaScript bundle. Jekyll (and any Liquid
 * step in front of it) reacts to the sequences `{{`, `}}`, `{%` and `%}`, and
 * minified JavaScript is full of `}}` from nested blocks.
 *
 * This module removes those sequences without changing what the code does:
 *
 *   - outside a literal, insert one space between the two characters
 *     (`} }`, `{ {`). A space is a valid token separator everywhere these can
 *     occur in code;
 *   - inside a string, template literal or regular expression, write the
 *     second character as an escape (`}\x7d`) so the source no longer contains
 *     the pair while the runtime value stays identical.
 *
 * Literal boundaries come from acorn's tokenizer, not from a hand-written
 * scanner: getting quotes and regexes right by eye is exactly the bug this
 * avoids.
 * ------------------------------------------------------------------------- */

import { parse } from "acorn";

function literalRanges(code) {
  const tokens = [];
  parse(code, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowHashBang: true,
    onToken: tokens
  });
  const ranges = [];
  for (const t of tokens) {
    const label = t.type && t.type.label;
    if (label === "string" || label === "template" || label === "regexp") {
      ranges.push([t.start, t.end]);
    }
  }
  return ranges;
}

function insideLiteral(ranges, index) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (index < r[0]) hi = mid - 1;
    else if (index >= r[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

const ESCAPE = { "%": "\\x25", "{": "\\x7b", "}": "\\x7d" };

export function liquidSafeJs(code) {
  const ranges = literalRanges(code);
  let out = "";
  let i = 0;

  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];
    const pair =
      (c === "{" && (n === "{" || n === "%")) ||
      (c === "}" && n === "}") ||
      (c === "%" && n === "}");

    if (!pair) {
      out += c;
      i++;
      continue;
    }

    if (insideLiteral(ranges, i)) {
      out += c + ESCAPE[n];
      i += 2;
      continue;
    }
    out += c + " ";
    i++;
  }

  return out;
}

export function findLiquidSequences(text) {
  const found = [];
  if (/\{\{/.test(text)) found.push("{{");
  if (/\}\}/.test(text)) found.push("}}");
  if (/\{%/.test(text)) found.push("{%");
  if (/%\}/.test(text)) found.push("%}");
  return found;
}
