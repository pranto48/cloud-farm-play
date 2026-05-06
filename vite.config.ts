import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When deploying on Vercel (VERCEL env var is set during their build),
// disable the Cloudflare Workers plugin so the build produces a standard
// TanStack Start output that Vercel can serve.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
});
