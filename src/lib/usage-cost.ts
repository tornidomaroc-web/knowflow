/**
 * THE PRICE OF ONE MODEL CALL, FOR THE `kf-usage` LOG LINE ONLY.
 *
 * Three routes call Claude Haiku 4.5 (`/api/agent`, `/api/summarize`,
 * `/api/quiz/generate`), and each writes one `kf-usage` line per call. The rates
 * live here once so the three lines cannot price the same token differently.
 *
 * Published Haiku 4.5 rates, first read 2026-09-13 from claude.com/pricing and
 * re-read 2026-09-23 from platform.claude.com/docs/en/about-claude/pricing:
 * $1 / MTok input, $5 / MTok output, $0.10 / MTok cache reads, $1.25 / MTok
 * 5-minute cache writes. They ANNOTATE a log line and never gate behaviour, so a
 * stale rate mislabels a line and breaks nothing. Re-read before quoting a
 * figure anywhere money is decided (register #80 says why).
 */

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export const USD_PER_INPUT_TOKEN = 1.0 / 1_000_000;
export const USD_PER_OUTPUT_TOKEN = 5.0 / 1_000_000;
export const USD_PER_CACHE_READ_TOKEN = 0.10 / 1_000_000;
export const USD_PER_CACHE_WRITE_TOKEN = 1.25 / 1_000_000;

/** The token fields every `kf-usage` line carries, read from `response.usage`. */
export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

/**
 * Read the four counts off an Anthropic `usage` object. Missing fields read as
 * 0, never as NaN, so a partial `usage` still yields a line that parses.
 */
export function usageTokens(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): UsageTokens {
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

/** The dollar figure for one call, rounded as the agent line has always rounded it. */
export function usageUsd(t: UsageTokens): number {
  const usd =
    t.input_tokens * USD_PER_INPUT_TOKEN +
    t.output_tokens * USD_PER_OUTPUT_TOKEN +
    t.cache_read_tokens * USD_PER_CACHE_READ_TOKEN +
    t.cache_write_tokens * USD_PER_CACHE_WRITE_TOKEN;
  return Number(usd.toFixed(6));
}
