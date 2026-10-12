/**
 * THE APP'S WORDING RULE, ONE SOURCE (Apple 3.1.3(f); Step Wording-1).
 *
 * Inside the iOS app no text may name a plan, a subscription, an upgrade, a
 * premium or Pro tier, a price, a checkout, or "free". `KF_WORDING_SRC` is an
 * ES5 function kept as text, so the SAME bytes run in the in-app probe
 * (ios/App/App/MainViewController.swift embeds it, with each backslash doubled
 * for the Swift string, and scripts/verify-app-wording.mjs fails if that copy
 * drifts) and in the Node proofs (evaluated below).
 *
 * English is matched case-insensitively on word boundaries. Arabic is matched
 * by STEM after normalising: diacritics and tatweel removed, every alef form
 * to bare alef, ta marbuta to ha, alef maqsura to ya. So باقة, الباقة, باقتك,
 * بباقتك and الباقات all reach باق followed by ه, ت or ا; اشتراك, الاشتراك,
 * اشتراكك and اشترك all reach اشترا?ك. "أسئلة باقية" (questions left) does
 * not: after باق comes ي. خطة needs a word start before it, so مخطط and
 * الخطوط stay clean.
 *
 * Returns the names of the rules hit; empty when the text is clean.
 */
export const KF_WORDING_SRC = String.raw`function kfWording(T){var h=[];var E=[['plan',/\bplans?\b/i],['subscription',/\bsubscri(?:be|bed|bes|ber|bers|bing|ption|ptions)\b/i],['upgrade',/\bupgrad(?:e|es|ed|ing)\b/i],['premium',/\bpremium\b/i],['pro',/\bpro\b/i],['price',/\bpric(?:e|es|ed|ing)\b/i],['free',/\bfree\b/i],['checkout',/\bcheck-?out\b/i],['currency',/\$\s?\d|\d\s?(?:usd|eur|mad|dhs?|dirhams?)\b|\/\s?mo(?:nth)?\b|\bper month\b/i]];for(var i=0;i<E.length;i++){if(E[i][1].test(T))h.push(E[i][0])}var N=T.replace(/[ً-ٰٟـ]/g,'').replace(/[آأإٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');var A=[['باقة',/باق[هتا]/],['اشتراك',/اشترا?ك/],['ترقية',/ترقي[هت]/],['مجاني',/مجان/],['سعر',/سعر|اسعار/],['احترافي',/احتراف/],['خطة',/(?:^|[^ء-ي])(?:ال|و|ب|ف|ل)?خط[هت]/],['شهريا',/شهريا/]];for(var j=0;j<A.length;j++){if(A[j][1].test(N))h.push(A[j][0])}return h}`;

// The same text, as a function, for the Node proofs.
// eslint-disable-next-line no-new-func
export const kfWording = new Function(`${KF_WORDING_SRC}; return kfWording;`)();
