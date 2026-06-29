export const FREE_LIMITS = {
  knowledge_bases: 2,
  documents: 10,
  conversations_per_month: 100,
}

// Pro tier (B1): Pro users were silently capped at FREE_LIMITS — limits-server
// never read entitlement, so Pro bought nothing. These are the unlocked caps.
// Shape is pinned to FREE_LIMITS via `satisfies` so the two can't drift apart.
// NOTE (values are a product/pricing call): generous finite caps, not unlimited,
// to keep one abuse ceiling. Tune freely — changing a number here is the only edit.
export const PRO_LIMITS = {
  knowledge_bases: 50,
  documents: 200,
  conversations_per_month: 2000,
} satisfies typeof FREE_LIMITS
