import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';

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

// 2. SSR function (Node serverless)
const fnDir = `${outRoot}/functions/ssr.func`;
mkdirSync(fnDir, { recursive: true });
if (!existsSync('dist/server/server.js')) {
  throw new Error('dist/server/server.js not found — TanStack Start build did not emit SSR output.');
}
cpSync('dist/server', `${fnDir}/server`, { recursive: true });

writeFileSync(
  `${fnDir}/index.mjs`,
  `import handler from './server/server.js';
export default async function (request) {
  return handler.fetch(request);
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
