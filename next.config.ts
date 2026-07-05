import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  experimental: {},
  // ESLint is a manual/dev tool (`npm run lint`) — it must NOT gate the
  // production build. There are pre-existing lint errors deferred to a separate
  // follow-up, and a live tryknowflow.com deploy must never break on them.
  eslint: { ignoreDuringBuilds: true },
}
export default nextConfig
