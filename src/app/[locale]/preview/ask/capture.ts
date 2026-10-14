/**
 * Step Store-Fix-2, item 5: the Arabic Ask conversation of capture run
 * 38618442205 (ar/04, account +kfshots-ar), for the fit render
 * (scripts/redesign-built/render-fix2.mjs through `?view=capture`).
 *
 * WHAT IS VERBATIM. The question, the heading, the first three paragraphs and
 * the first two lines of the fourth, as the PNG shows them; the markdown marks
 * are read from the PNG too: the heading is drawn at text-lg (h1, 28 pt
 * lines), each block one blank line apart (the pre-wrap gap), the labels bold.
 *
 * WHAT IS NOT. The run kept no answer text past the step reading's first 400
 * characters, and the PNG ends inside the fourth paragraph. `CAPTURE_TAIL` is
 * a stand-in for the rest of that paragraph; the render takes its first
 * `?tail=N` words and picks N so the OLD bubble (pre-wrap) puts the first
 * source where the device measured it: 594 px below the question's top
 * (question top 16, first source bottom 610, list 444). The sources row
 * wrapped to two lines on the device (all sources bottom 662, 52 below the
 * first); the three pills below reproduce that, and the render reports it.
 *
 * The English set (`CAPTURE_EN`) is not from a capture: it is the same shape
 * (a heading, an opening line, two labelled paragraphs and a longer one) on
 * plan.json's English question, so the bubble's spacing can be looked at in
 * both languages.
 */
export const CAPTURE_SUBJECTS = [
  { id: 's1', name: 'علوم الحياة والأرض' },
  { id: 's2', name: 'الاقتصاد العام' },
  { id: 's3', name: 'التاريخ والجغرافيا' },
]

export const CAPTURE_QUESTION = 'ما الفرق بين التنفس الخلوي والتخمر من حيث الحصيلة الطاقية؟'
/** docs/store/screenshot-content/plan.json from this step on. */
export const CAPTURE_QUESTION_NEW = 'باختصار، ما الفرق بين التنفس الخلوي والتخمر من حيث الحصيلة الطاقية؟'

const HEAD = [
  '# الفرق بين التنفس الخلوي والتخمر من حيث الحصيلة الطاقية',
  'الفرق كبير جداً:',
  '**التنفس الخلوي:** ينتج من 36 إلى 38 جزيئة **ATP** من هدم جزيئة غلوكوز واحدة [1]',
  '**التخمر:** ينتج فقط **جزيئتين من ATP** من هدم جزيئة غلوكوز واحدة [1]',
]
const FOURTH = 'السبب في هذا الاختلاف الكبير أن التنفس الخلوي يقوم بهدم **كلي** للغلوكوز في وجود الأكسجين'
export const CAPTURE_TAIL = '، بينما يقوم التخمر بهدم **جزئي** فقط في غياب الأكسجين، فتبقى في نواتجه طاقة كامنة لم تُحرَّر مثل الكحول الإيثيلي أو حمض اللبن [1]. أما في التنفس الخلوي فيتأكسد الغلوكوز كلياً إلى ثنائي أكسيد الكربون والماء، وتُستعمل الطاقة المحرَّرة في تركيب جزيئات ATP داخل الميتوكوندريا عبر السلسلة التنفسية والفسفرة المؤكسدة [1]. لهذا تكون الحصيلة الطاقية للتنفس أكبر بنحو تسع عشرة مرة من حصيلة التخمر [1].'

export function captureAnswer(tailWords: number): string {
  const words = CAPTURE_TAIL.split(' ')
  const tail = words.slice(0, Math.max(0, Math.min(words.length, tailWords))).join(' ')
  return [...HEAD, FOURTH + tail].join('\n\n')
}

export const CAPTURE_TAIL_WORDS = CAPTURE_TAIL.split(' ').length

export const CAPTURE_CITATIONS = [
  { index: 1, document_id: 'd1', chunk_id: 'c1', filename: 'التنفس الخلوي والتخمر.md', similarity: 0.9 },
  { index: 2, document_id: 'd1', chunk_id: 'c2', filename: 'التنفس الخلوي والتخمر.md', similarity: 0.86 },
  { index: 3, document_id: 'd2', chunk_id: 'c3', filename: 'الخبر الوراثي ونقله.md', similarity: 0.71 },
]

export const CAPTURE_EN = {
  subjects: [
    { id: 's1', name: 'Biology' },
    { id: 's2', name: 'Economics' },
    { id: 's3', name: 'History' },
  ],
  question: 'How does the energy yield of respiration compare with fermentation?',
  answer: [
    '# Energy yield: respiration and fermentation',
    'The difference is large:',
    '**Cellular respiration:** 36 to 38 molecules of **ATP** from one molecule of glucose [1]',
    '**Fermentation:** only **2 ATP** from one molecule of glucose [1]',
    'Respiration breaks glucose down completely with oxygen, to carbon dioxide and water, while fermentation breaks it down only in part, without oxygen, and leaves energy in its products such as ethanol or lactic acid [1].',
  ].join('\n\n'),
  citations: [
    { index: 1, document_id: 'd1', chunk_id: 'c1', filename: 'Cellular respiration and fermentation.md', similarity: 0.9 },
    { index: 2, document_id: 'd2', chunk_id: 'c2', filename: 'DNA and protein synthesis.md', similarity: 0.7 },
  ],
}
