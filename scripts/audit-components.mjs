import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = walk("src");
const sources = files.map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
const components = files.filter((file) => file.startsWith(path.join("src", "components")));

let unused = 0;
for (const file of components) {
  const base = path.basename(file).replace(/\.(ts|tsx)$/, "");
  const importPattern = new RegExp(`from ["'][^"']*/${base}["']`);
  const hits = sources
    .filter((source) => source.file !== file && importPattern.test(source.text))
    .map((source) => path.relative(".", source.file));
  if (hits.length === 0) {
    unused += 1;
    console.log(`UNUSED  ${path.relative(".", file)}`);
  }
}
console.log(`\n${components.length - unused}/${components.length} component files are imported somewhere`);
process.exit(unused ? 1 : 0);
