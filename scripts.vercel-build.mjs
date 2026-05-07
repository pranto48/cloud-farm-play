import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { build as esbuild } from 'esbuild';

execSync('npm run build', { stdio: 'inherit' });

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

// 2. SSR function (Node serverless) — bundle dependencies so Vercel doesn't
// need node_modules at runtime.
const fnDir = `${outRoot}/functions/ssr.func`;
mkdirSync(fnDir, { recursive: true });
if (!existsSync('dist/server/server.js')) {
  throw new Error('dist/server/server.js not found — TanStack Start build did not emit SSR output.');
}
// Copy chunked assets (lazy-imported by server.js via relative ./assets/*) as-is.
if (existsSync('dist/server/assets')) {
  cpSync('dist/server/assets', `${fnDir}/server/assets`, { recursive: true });
}
// Bundle the entry server.js with all bare-specifier deps inlined.
await esbuild({
  entryPoints: ['dist/server/server.js'],
  outfile: `${fnDir}/server/server.js`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  allowOverwrite: false,
  external: [], // bundle everything from node_modules
  banner: {
    js: "import { createRequire as __cjsCreateRequire } from 'node:module';\nimport { fileURLToPath as __cjsFileURLToPath } from 'node:url';\nimport { dirname as __cjsDirname } from 'node:path';\nconst require = __cjsCreateRequire(import.meta.url);\nconst __filename = __cjsFileURLToPath(import.meta.url);\nconst __dirname = __cjsDirname(__filename);",
  },
  // Mark dynamic-imported chunks as external so they resolve at runtime to the
  // copied ./assets/* files instead of being bundled (and renamed).
  plugins: [
    {
      name: 'externalize-relative-assets',
      setup(build) {
        build.onResolve({ filter: /^\.\/assets\// }, (args) => ({ path: args.path, external: true }));
      },
    },
  ],
  logLevel: 'info',
});

writeFileSync(
  `${fnDir}/index.mjs`,
  `import { Readable } from 'node:stream';
import handler from './server/server.js';

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
