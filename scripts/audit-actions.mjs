import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const all = walk("src");
const actionsDir = path.join("src", "app", "actions");
const actionFiles = all.filter((file) => file.startsWith(actionsDir));
const consumers = all.filter((file) => !file.startsWith(actionsDir));

const consumerSources = consumers.map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
const names = [];
for (const file of actionFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/export async function (\w+)/g)) {
    names.push({ file: path.relative(".", file), name: match[1] });
  }
}

let dead = 0;
for (const { file, name } of names) {
  const hits = consumerSources
    .filter((source) => new RegExp(`\\b${name}\\b`).test(source.text))
    .map((source) => path.relative(".", source.file));
  if (hits.length === 0) {
    dead += 1;
    console.log(`DEAD  ${file} :: ${name}`);
  } else {
    console.log(`USED  ${file} :: ${name} -> ${hits.join(", ")}`);
  }
}
console.log(`\n${names.length - dead}/${names.length} server actions are referenced by UI or tests`);
process.exit(dead ? 1 : 0);
