/**
 * Thin client for the FastAPI ingestion service.
 * Handles bearer-token auth and surfaces helpful errors.
 */

const SERVICE_URL = process.env.INGESTION_SERVICE_URL || 'http://localhost:8000';

function getToken(): string {
  const token = process.env.INGESTION_TOKEN;
  if (!token) throw new Error('INGESTION_TOKEN is not configured');
  return token;
}

export async function embedQuery(text: string): Promise<number[]> {
  const resp = await fetch(`${SERVICE_URL}/embed`, {
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
