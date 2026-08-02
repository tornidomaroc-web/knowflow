/**
 * Thin client for the FastAPI ingestion service.
 * Handles bearer-token auth and surfaces helpful errors.
 */

/**
 * Resolve the ingestion service base URL.
 *
 * The localhost fallback is a DEVELOPMENT convenience and nothing else. In
 * production it is actively harmful: an unset or misspelled
 * INGESTION_SERVICE_URL points every embed and every upload at a port that
 * isn't there, and the Ask path swallows the resulting throw
 * (src/app/api/agent/route.ts) — so the user sees "I can't find that in your
 * materials" instead of an outage. Fail loudly in production instead, exactly
 * the way getToken() already does for INGESTION_TOKEN. The asymmetry between
 * the two — one throws, one silently rewrote itself to localhost — was not
 * deliberate.
 *
 * A function rather than a module-scope const so the value is read at call
 * time, not at import time.
 */
export function getServiceUrl(): string {
  const url = process.env.INGESTION_SERVICE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INGESTION_SERVICE_URL is not configured');
  }
  return 'http://localhost:8000';
}

function getToken(): string {
  const token = process.env.INGESTION_TOKEN;
  if (!token) throw new Error('INGESTION_TOKEN is not configured');
  return token;
}

export async function embedQuery(text: string): Promise<number[]> {
  const resp = await fetch(`${getServiceUrl()}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ text, input_type: 'query' }),
  });

  if (!resp.ok) {
    throw new Error(`Embedding service returned ${resp.status}`);
  }

  const data: { embedding: number[] } = await resp.json();
  return data.embedding;
}
