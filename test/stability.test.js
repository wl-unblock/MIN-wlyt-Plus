const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.js');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.json'));
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const railway = JSON.parse(read('railway.json'));
const render = read('render.yaml');

test('Node runtime is pinned consistently to supported Node 24', () => {
  assert.equal(packageJson.engines.node, '>=24 <25');
  assert.equal(packageLock.packages[''].engines.node, packageJson.engines.node);
  assert.equal(read('.nvmrc').trim(), '24');
  assert.equal(railway.build.env.NODE_VERSION, '24');
  assert.match(render, /key: NODE_VERSION\s+value: "24"/);
});

test('hosting health checks use an upstream-independent endpoint', () => {
  assert.match(index, /app\.get\("\/healthz"/);
  assert.match(render, /healthCheckPath:\s*\/healthz/);
  assert.equal(railway.deploy.healthcheckPath, '/healthz');
});

test('PWA starts at the routed application hub', () => {
  assert.equal(manifest.start_url, '/youtube-pro');
  assert.match(index, /app\.get\("\/youtube-pro"[\s\S]*?public["],\s*"min-tube-pro\.html"/);
  assert.ok(fs.existsSync(path.join(root, 'public', 'min-tube-pro.html')));
});

test('manifest, service worker, and icons map to files that exist', () => {
  const routes = [
    { route: '/manifest.json', file: 'manifest.json', pattern: /app\.get\("\/manifest\.json"[\s\S]*?path\.join\(__dirname,\s*"manifest\.json"\)/ },
    { route: '/sw.js', file: 'sw.js', pattern: /app\.get\("\/sw\.js"[\s\S]*?path\.join\(__dirname,\s*"sw\.js"\)/ },
    { route: '/min-img.png', file: 'img/min-tube-pro.png', pattern: /app\.get\("\/min-img\.png"[\s\S]*?path\.join\(__dirname,\s*"img",\s*"min-tube-pro\.png"\)/ },
    { route: '/classroom.192', file: 'img/classroom.192.png', pattern: /app\.get\("\/classroom\.192"[\s\S]*?path\.join\(__dirname,\s*"img",\s*"classroom\.192\.png"\)/ },
    { route: '/classroom.512', file: 'img/classroom.512.png', pattern: /app\.get\("\/classroom\.512"[\s\S]*?path\.join\(__dirname,\s*"img",\s*"classroom\.512\.png"\)/ },
  ];

  for (const item of routes) {
    assert.ok(fs.existsSync(path.join(root, item.file)), `${item.file} should exist`);
    assert.match(index, item.pattern, `${item.route} should serve ${item.file}`);
  }

  for (const icon of manifest.icons) {
    assert.ok(routes.some(item => item.route === icon.src), `${icon.src} should have an Express route`);
  }
});

test('service worker only precaches valid app-shell paths', () => {
  const match = serviceWorker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(match, 'PRECACHE list should be present');

  const precache = [...match[1].matchAll(/[\"']([^\"']+)[\"']/g)].map(item => item[1]);
  assert.deepEqual(precache, [
    '/youtube-pro',
    '/manifest.json',
    '/min-img.png',
    '/classroom.192',
    '/classroom.512',
  ]);
  assert.doesNotMatch(serviceWorker, /\/public\/min-tube-pro\.html|\/img\/min-tube-pro\.png/);
});
