import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (!path.endsWith('.map') && !path.endsWith('/sw.js')) files.push(path);
  }
}
await walk('dist');
files.sort();
const hash = createHash('sha256');
hash.update(await readFile('public/sw.js'));
for (const path of files) {
  hash.update(path);
  hash.update(await readFile(path));
}
const version = hash.digest('hex').slice(0, 16);
const precache = files.map((path) => '/' + path.slice(5));
const worker = (await readFile('public/sw.js', 'utf8'))
  .replace('__CIMBRA_VERSION__', version)
  .replace('/* __CIMBRA_PRECACHE__ */ []', JSON.stringify(precache));
await writeFile('dist/sw.js', worker);
console.log(`PWA ${version}: ${precache.length} static resources precached. User data excluded.`);
