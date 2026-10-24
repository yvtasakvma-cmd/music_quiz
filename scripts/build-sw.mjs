import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
async function list(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await list(path));
    else if (entry.name !== 'sw.js') paths.push(path);
  }
  return paths;
}
const files = (await list(root)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const name = hash.digest('hex').slice(0, 16);
const paths = files.map((file) => relative(root, file).split(sep).join('/'));
await writeFile(join(root, 'sw.js'), `
const BASE = new URL('./', self.location.href);
const PREFIX = 'cadence:' + BASE.pathname + ':';
const CACHE = PREFIX + ${JSON.stringify(name)};
const FILES = ${JSON.stringify(paths)}.map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== BASE.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', BASE).href, { ignoreVary: true }))));
  } else if (FILES.includes(event.request.url)) {
    // The allowlist contains only this build's public static files. Hosts may
    // add Vary: Origin; a module request must still match its precached file.
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
  }
});
`);
console.log(`Offline cache: ${paths.length} files (${name})`);
