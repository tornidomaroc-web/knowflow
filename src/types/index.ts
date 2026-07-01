export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  plan: 'free' | 'pro';
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  language: 'ar' | 'en' | 'both';
  created_at: string;
}

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'mp3' | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  markdown_content: string | null;
  chunk_count: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  kb_id: string;
  user_id: string;
  platform: 'web' | 'telegram' | 'slack';
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * Billing tier derived from the `subscriptions` table — the single source of
 * truth for entitlement (see docs/PIVOT_PLAN.md §3). Distinct from
 * `Profile.plan`, which is being retired as an entitlement signal (B2).
 */
export type Tier = 'free' | 'pro';

/**
 * The entitlement contract read by both the web app and the mobile app
 * (via GET /api/entitlement). Mobile keys ad display off `adsEnabled`; it never
 * computes entitlement locally.
 */
export interface Entitlement {
  tier: Tier;
  adsEnabled: boolean;
  /** ISO timestamp the current Pro period ends, or null when free. */
  expiresAt: string | null;
}
