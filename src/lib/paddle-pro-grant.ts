/**
 * WHICH SUBSCRIPTION MAY GRANT PRO (fix/paddle-safety).
 *
 * The checkout route puts our own price id and the session's user id into
 * the transaction, and the student cannot change that transaction. But the
 * browser holds a PUBLIC client token, so a signed-in student can also open a
 * Paddle checkout for ANY active price in the account, with any
 * `customData.user_id`, without calling our route at all. Until this rule,
 * the webhook granted Pro from `status` and `customData.user_id` alone, so
 * any other recurring price in the account (a cheaper one, a trial, another
 * product) would have bought KnowFlow Pro.
 *
 * The rule: an entitling status is written only when the subscription holds
 * EXACTLY ONE item, priced `PADDLE_PRO_PRICE_ID`, with quantity 1. A quantity
 * above 1 is refused too: it is not a purchase we sell (the owner sets the
 * price's maximum quantity to 1; this is the second line behind that).
 *
 * Returns null when the items qualify, otherwise a short reason for the log
 * (no secret in it: price ids are not secrets).
 */
export interface ItemLike {
  quantity?: number | null;
  price?: { id?: string | null } | null;
}

export function proItemsProblem(items: readonly ItemLike[] | null | undefined, proPriceId: string): string | null {
  const list = items ?? [];
  if (list.length !== 1) {
    return `${list.length} item(s), want exactly 1: ${describeItems(list)}`;
  }
  const [item] = list;
  if (item.price?.id !== proPriceId) return `price ${item.price?.id ?? '(none)'} is not the Pro price`;
  if (item.quantity !== 1) return `quantity ${item.quantity ?? '(none)'}, want 1`;
  return null;
}

/** `pri_x x1, pri_y x2`: what the log records about a subscription's items. */
export function describeItems(items: readonly ItemLike[]): string {
  return items.map((i) => `${i.price?.id ?? '(no price)'} x${i.quantity ?? '?'}`).join(', ') || '(none)';
}
