import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

execSync('npm run build', { stdio: 'inherit' });

const candidates = ['dist/client', '.output/public', 'dist'];
const source = candidates.find((p) => existsSync(p));
if (!source) {
  throw new Error(`No static build output found. Checked: ${candidates.join(', ')}`);
}

const out = 'vercel-static';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(source, out, { recursive: true });

console.log(`[vercel-build] Using static output from: ${source}`);
console.log(`[vercel-build] Copied to: ${out}`);
