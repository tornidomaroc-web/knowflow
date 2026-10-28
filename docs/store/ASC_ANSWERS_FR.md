# App Store listing in French (fr-FR), version 1.0.1

**Approved by the owner on 2026-10-28** in chat (fields at 19:50, the French
description at 19:52), as `ASO_1.0.1_APPROVED.md`, SHA-256
`c6db0d75a536bbdb598c7bdcb30542f3ce9f2f8b3aec8598db01bebd2d720757`. The texts below are that file's bytes;
nothing was reworded. 

The `fr-fr` mode of `.github/workflows/asc-store-setup.yml` writes the
fr-FR fields of an editable version (1.0.1 in Prepare for Submission) from
this file, and refuses unless `ASC_ANSWERS_FR.approved` holds the SHA-256
of this file with LF line ends. Any edit to this file blocks the write until
it is approved again.

The app has no French interface. The listing says so (promotional text "En
arabe et en anglais", description "L'application est en arabe et en anglais")
and names the Settings tab by its English label, as the app shows it. The
site has no French pages, so both URLs are the English ones and the
description says "(en anglais)" next to them.

Why fr-FR: in Morocco, Algeria and Tunisia the store also indexes fr-FR (the
owner's basis, as for en-GB).

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

## Name (27 of 30)

<!-- asc-fr:name:begin -->
```
KnowFlow : Révise tes cours
```
<!-- asc-fr:name:end -->

## Subtitle (24 of 30)

<!-- asc-fr:subtitle:begin -->
```
Résumés et quiz par l'IA
```
<!-- asc-fr:subtitle:end -->

## Keywords (96 of 100)

<!-- asc-fr:keywords:begin -->
```
étude,révision,examen,bac,fiche,résumé,étudiant,université,fac,devoirs,questions,pdf,notes,lycée
```
<!-- asc-fr:keywords:end -->

## Promotional text (151 of 170)

<!-- asc-fr:promotionalText:begin -->
```
Importe ton cours ou tes notes, puis pose ta question. Chaque réponse vient de tes propres fichiers, avec un résumé et un quiz. En arabe et en anglais.
```
<!-- asc-fr:promotionalText:end -->

## Description (2,064 of 4,000)

<!-- asc-fr:description:begin -->
```
KnowFlow transforme tes fichiers de cours en réponses, en résumés et en quiz.

Ajoute une matière, importe tes notes de cours, tes diapositives ou tes lectures, puis pose tes questions comme tu le ferais à un camarade. Chaque réponse est rédigée à partir des fichiers de cette matière et indique le fichier d'où elle vient, pour que tu puisses vérifier toi-même.

L'application est en arabe et en anglais. Tu peux poser tes questions dans l'une ou l'autre langue.

CE QUE TU PEUX FAIRE
• Organiser tes études par matière, avec les fichiers de chaque matière à l'intérieur.
• Importer des fichiers PDF, Word, PowerPoint, Excel, texte et Markdown, jusqu'à 4 Mo par fichier.
• Poser une question en arabe ou en anglais et obtenir une réponse claire tirée de tes propres fichiers, avec le nom du fichier source.
• Ouvrir le résumé de n'importe quel fichier pour réviser rapidement.
• Te tester avec un quiz de cinq questions créé à partir d'un fichier, puis vérifier tes réponses.
• Garder une série d'étude quotidienne et suivre tes progrès sur l'écran d'accueil.
• Activer un rappel d'étude quotidien à l'heure de ton choix. Il reste sur ton téléphone.
• Utiliser l'application en arabe ou en anglais, avec un thème sombre ou clair.

TA PERMISSION D'ABORD
Les réponses, les résumés et les quiz sont rédigés par une IA. Avant tout envoi, KnowFlow te demande ta permission et nomme les deux entreprises concernées : Anthropic, qui rédige les réponses, les résumés et les quiz, et Voyage AI, qui prépare le texte pour retrouver le bon passage. Aucune des deux ne reçoit ton nom ni ton adresse e-mail. Tu peux retirer ta permission à tout moment dans l'onglet Settings de l'application.

TON COMPTE ET TES DONNÉES
Renomme ou supprime n'importe quel fichier quand tu veux, et supprime ton compte et tout son contenu depuis l'onglet Settings.

Une IA peut se tromper. Vérifie les réponses importantes dans tes fichiers.

Politique de confidentialité (en anglais) : https://tryknowflow.com/en/privacy
Conditions d'utilisation (en anglais) : https://tryknowflow.com/en/terms
```
<!-- asc-fr:description:end -->

## URLs (English pages; the site has no French)

<!-- asc-fr:supportUrl:begin -->
```
https://tryknowflow.com/en/contact
```
<!-- asc-fr:supportUrl:end -->

<!-- asc-fr:privacyPolicyUrl:begin -->
```
https://tryknowflow.com/en/privacy
```
<!-- asc-fr:privacyPolicyUrl:end -->

The Marketing URL stays empty (`docs/store/ASC_ANSWERS.md` section 3).
