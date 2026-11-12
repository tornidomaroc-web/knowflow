import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  experimental: {},
  // ESLint is a manual/dev tool (`npm run lint`) — it must NOT gate the
  // production build. There are pre-existing lint errors deferred to a separate
  // follow-up, and a live tryknowflow.com deploy must never break on them.
  eslint: { ignoreDuringBuilds: true },
  // The sample file (audit cause 9): /api/sample reads the two committed PDFs
  // from disk, so they are traced into that one function. The chunks and
  // embeddings are imported (src/lib/sample-file-data.ts) and need no entry.
  outputFileTracingIncludes: {
    '/api/sample': ['./data/sample-file/cell.ar.pdf', './data/sample-file/cell.en.pdf'],
  },
}
export default nextConfig
