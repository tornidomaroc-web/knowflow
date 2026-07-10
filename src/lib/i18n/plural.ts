/**
 * Phase 5 (P5.3, follow-up) — plural form selection for counted nouns.
 *
 * Fixes a real defect found on preview `3af9dd5`: the streak card rendered
 * "1 أيام" — the plural of يوم applied to the number one. §5's "never promise what
 * the app doesn't do" extends to the app not misreading its own primary language
 * back at the student.
 *
 * ============================================================================
 * THIS IS FORM SELECTION, NOT SUFFIXING
 * ============================================================================
 * English picks between two forms with a rule most code gets away with inlining
 * (`n === 1 ? 'day' : 'days'`). Arabic picks between SIX, keyed on the number:
 *
 *   zero  n = 0            أيام
 *   one   n = 1            يوم
 *   two   n = 2            يومان
 *   few   n % 100 = 3..10  أيام      (3 أيام)
 *   many  n % 100 = 11..99 يومًا      (11 يومًا — singular accusative, not plural)
 *   other everything else  يوم       (100 يوم)
 *
 * No suffix rule produces that. It is a lookup keyed on a CATEGORY, and the
 * category is a property of the number and the locale, not of the noun.
 *
 * ============================================================================
 * WHY Intl.PluralRules AND NOT A LIBRARY, AND NOT HAND-ROLLED MODULO
 * ============================================================================
 * `Intl.PluralRules` IS the CLDR plural-category algorithm, already present in
 * every browser and in Node (this project's `tsconfig.json` has `lib: [..., "esnext"]`,
 * so it is typed). It costs ZERO bytes of dependency — the budget for one is zero —
 * and zero maintenance.
 *
 * Hand-rolling the modulo arithmetic would have been cheap to write and wrong at the
 * edges: the naive reading "11 and above → يومًا" breaks at 100, where the category is
 * `other` (100 يوم, not 100 يومًا), and again at 103, where `n % 100 = 3` puts it back
 * in `few` (103 أيام). A hundred-day streak is an entirely reachable number for a
 * study app, so that edge is not theoretical. Delegating to the runtime's CLDR data
 * gets all of it right, including languages nobody here can audit.
 *
 * The API is locale-shaped, not Arabic-shaped: English supplies `{ one, other }` and
 * never sees `two`/`few`/`many`. A locale declares only the forms its rules can
 * select, and `other` is the required fallback for every locale.
 */

/**
 * The plural forms of one counted noun, keyed by CLDR plural category.
 *
 * `other` is mandatory: it is the category every locale can select, and the fallback
 * when a locale's rules produce a category this noun did not declare. The rest are
 * optional so English is not forced to invent an Arabic dual.
 */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

// `Intl.PluralRules` construction is not free and the locale set is tiny and fixed.
// Built lazily, once per locale, for the life of the process.
const rulesCache = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules | null {
  const cached = rulesCache.get(locale);
  if (cached) return cached;
  try {
    const rules = new Intl.PluralRules(locale);
    rulesCache.set(locale, rules);
    return rules;
  } catch {
    // An environment without full ICU, or a locale it does not know. Fall back to
    // `other` rather than throwing: a slightly wrong noun is a far smaller failure
    // than a crashed dashboard.
    return null;
  }
}

/**
 * Select the correct form of a counted noun for `count` in `locale`.
 *
 * Returns the NOUN only, never the number — the streak card styles the numeral and
 * the unit differently, so joining them here would flatten the design. Callers
 * render `{count} {pluralize(...)}`.
 *
 * Note for a future reviewer: CLDR's own Arabic unit patterns DROP the numeral for
 * `one` and `two` (يوم / يومان already mean "one day" / "two days", so "2 يومان" is
 * mildly redundant to a native ear). Preserving the number/unit split is a deliberate
 * design tradeoff, not an oversight — see the PR discussion. Changing it means
 * returning a whole phrase and reworking the card's typography.
 */
export function pluralize(locale: string, count: number, forms: PluralForms): string {
  const rules = rulesFor(locale);
  if (!rules) return forms.other;

  // 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
  const category = rules.select(count);
  return forms[category] ?? forms.other;
}
