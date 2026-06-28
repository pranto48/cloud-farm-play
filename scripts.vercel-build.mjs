import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { nodeFileTrace } from '@vercel/nft';

execSync('npm run build', { stdio: 'inherit' });
console.log('[vercel-build] Building subproject ecs-canvas-game...');
execSync('cd ecs-canvas-game && npm install && npm run build', { stdio: 'inherit' });

// Build Vercel output API v3 layout (.vercel/output)
// - static client assets -> .vercel/output/static
// - SSR server bundle -> .vercel/output/functions/ssr.func
const outRoot = '.vercel/output';
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

// 1. Static assets
const staticDir = `${outRoot}/static`;
mkdirSync(staticDir, { recursive: true });
if (existsSync('dist/client')) {
  cpSync('dist/client', staticDir, { recursive: true });
}
if (existsSync('ecs-canvas-game/dist')) {
  cpSync('ecs-canvas-game/dist', `${staticDir}/arcane-survivors`, { recursive: true });
  console.log('[vercel-build] Copied ecs-canvas-game/dist to Vercel output static/arcane-survivors');
}

// 2. SSR function (Node serverless). Copy the SSR output as-is, then trace
// every node_modules file the bundle actually imports and copy them next to
// the function so Vercel's runtime can resolve them. We deliberately avoid
// esbuild bundling: bundling React causes duplicate React copies (or hook
// errors with externalized peers) which break SSR.
const fnDir = `${outRoot}/functions/ssr.func`;
mkdirSync(fnDir, { recursive: true });
if (!existsSync('dist/server/server.js')) {
  throw new Error('dist/server/server.js not found — TanStack Start build did not emit SSR output.');
}
cpSync('dist/server', `${fnDir}/dist/server`, { recursive: true });

const projectRoot = process.cwd();
const entry = resolve(projectRoot, 'dist/server/server.js');
const trace = await nodeFileTrace([entry], { base: projectRoot });
for (const w of trace.warnings) {
  // Only log unusual ones; missing optional deps are common and fine.
  const msg = w.message ?? String(w);
  if (!/Cannot find module|MODULE_NOT_FOUND/.test(msg)) console.warn('[nft]', msg);
}
let copied = 0;
for (const file of trace.fileList) {
  // server.js + assets already copied above; skip to avoid double work.
  if (file.startsWith('dist/server/')) continue;
  const src = resolve(projectRoot, file);
  if (!existsSync(src)) continue;
  const dest = resolve(fnDir, file);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  copied++;
}
console.log(`[vercel-build] Traced + copied ${copied} dependency files`);

writeFileSync(
  `${fnDir}/index.mjs`,
  `import { Readable } from 'node:stream';
import handler from './dist/server/server.js';

export default async function (req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, protocol + '://' + host).toString();

    const method = req.method || 'GET';
    const init = { method, headers: req.headers };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = Readable.toWeb(req);
      init.duplex = 'half';
    }
    const request = new Request(url, init);
    const response = await handler.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body);
      nodeStream.on('data', (chunk) => res.write(chunk));
      nodeStream.on('end', () => res.end());
      nodeStream.on('error', (err) => { console.error('[ssr] stream error', err); try { res.end(); } catch {} });
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[ssr] handler error', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
`,
);
writeFileSync(
  `${fnDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);
writeFileSync(`${fnDir}/package.json`, JSON.stringify({ type: 'module' }, null, 2));

// 3. Routing config: serve static first, then fall back to SSR function
const staticFiles = new Set(readdirSync(staticDir));
writeFileSync(
  `${outRoot}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/ssr' },
      ],
    },
    null,
    2,
  ),
);

console.log(`[vercel-build] Built Vercel output v3 at ${outRoot}`);
console.log(`[vercel-build] Static files at root: ${[...staticFiles].join(', ')}`);
