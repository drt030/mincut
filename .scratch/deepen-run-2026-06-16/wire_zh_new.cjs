/* Wire the 72 new deepening-node zh name+description into LanguageProvider's
   nodeTextZh + nodeDescriptionZh dicts. Inserts only keys not already present
   (guards against dup keys). Safe-escapes via JSON.stringify. */
const fs = require("fs");
const zh = JSON.parse(
  fs.readFileSync(".scratch/deepen-run-2026-06-16/zh-new-nodes.json", "utf8"),
);
const p = "src/components/LanguageProvider.tsx";
let s = fs.readFileSync(p, "utf8");

function dictKeys(src, name) {
  const start = src.indexOf(`const ${name}: Record<string, string> = {`);
  if (start < 0) throw new Error("dict not found: " + name);
  const end = src.indexOf("\n};", start);
  const body = src.slice(start, end);
  const keys = new Set();
  for (const m of body.matchAll(/^\s*"([^"]+)":/gm)) keys.add(m[1]);
  return keys;
}

function insert(src, name, entries) {
  const existing = dictKeys(src, name);
  const fresh = entries.filter(([k]) => !existing.has(k));
  const anchor = `const ${name}: Record<string, string> = {`;
  const idx = src.indexOf(anchor);
  const at = idx + anchor.length;
  const block = fresh
    .map(([k, v]) => `\n  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("");
  return {
    src: src.slice(0, at) + block + src.slice(at),
    added: fresh.length,
    skipped: entries.length - fresh.length,
  };
}

const names = Object.entries(zh)
  .filter(([, o]) => o.nameZh)
  .map(([id, o]) => [id, o.nameZh]);
const descs = Object.entries(zh)
  .filter(([, o]) => o.descriptionZh)
  .map(([id, o]) => [id, o.descriptionZh]);

let r1 = insert(s, "nodeTextZh", names);
s = r1.src;
let r2 = insert(s, "nodeDescriptionZh", descs);
s = r2.src;

fs.writeFileSync(p, s);
console.log("nodeTextZh: added", r1.added, "skipped(existing)", r1.skipped);
console.log("nodeDescriptionZh: added", r2.added, "skipped(existing)", r2.skipped);
