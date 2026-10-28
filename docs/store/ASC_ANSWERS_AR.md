# App Store listing in Arabic (ar-SA), version 1.0.1: subtitle and keywords

**Approved by the owner on 2026-10-28** in chat (fields at 19:50, the French
description at 19:52), as `ASO_1.0.1_APPROVED.md`, SHA-256
`c6db0d75a536bbdb598c7bdcb30542f3ce9f2f8b3aec8598db01bebd2d720757`. The texts below are that file's bytes;
nothing was reworded. Only these two fields change in 1.0.1.

The `arabic` mode of `.github/workflows/asc-store-setup.yml` writes the
ar-SA fields of an editable version (1.0.1 in Prepare for Submission) from
this file, and refuses unless `ASC_ANSWERS_AR.approved` holds the SHA-256
of this file with LF line ends. Any edit to this file blocks the write until
it is approved again.

The name, the promotional text and the description stay as approved on
2026-10-10 (`docs/store/ASC_ANSWERS.md` section 4.2). App Store Connect copies
them from 1.0 into 1.0.1, and the `arabic` mode never writes them.

The subtitle is the 1.0 subtitle with the shadda removed (23 code points
before, 22 now). It goes into the ar-SA App Info localization; the keywords go
into the ar-SA version localization of 1.0.1.

Rules (checked by `scripts/asc/store_setup.py check-locales` locally and by
the workflow before the key is read):
- each field within Apple's limit, counted in Unicode code points as App Store
  Connect counts them;
- no em dash or en dash;
- no plan, subscription, upgrade, premium, Pro, price, checkout or "free"
  wording (`scripts/lib/app-wording.mjs`, English and Arabic), and for French
  also gratuit, abonnement, prix, tarif, payant, forfait, offre, essai, achat,
  mise à niveau, par mois and the euro sign (`FR_WORDING` in
  `scripts/asc/store_setup.py`).

## Subtitle (22 of 30)

<!-- asc-ar:subtitle:begin -->
```
اسأل، لخص، واختبر نفسك
```
<!-- asc-ar:subtitle:end -->

## Keywords (100 of 100)

<!-- asc-ar:keywords:begin -->
```
ذكاء,اصطناعي,تلخيص,مذاكرة,امتحان,اختبار,مراجعة,محاضرة,اسئلة,شرح,دراسة,طالب,واجبات,جامعة,بكالوريا,PDF
```
<!-- asc-ar:keywords:end -->
