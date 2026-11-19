# Voice input in Ask: strings (DRAFT)

**Status: DRAFT for the owner, 2026-11-19.** Every string below is wired into
the code so the screens can be drawn and proved: `dashboard.agent.voice` in
`src/lib/i18n/locales/en.ts` and `ar.ts`, the two purpose strings in
`ios/App/App/Info.plist` and both `InfoPlist.strings`, the privacy sentence in
`src/app/[locale]/(site)/privacy/page.tsx`. None is approved until the owner
says so; an approved change is one edit here and one in each place above, and
`scripts/verify-voice-input.mjs` (section 5) fails if the bytes here and in the
code differ. On approval the Arabic UI rows move to a
`docs/copy/ARABIC_STRINGS_app_v13.md` batch as usual.

Base: the study's section 7 (`D:\Temp\kf-research\voice-study-9092d05\report.md`,
sha256 6488eae1...). Rules followed: Arabic is MSA with Western digits; no em
dash in either language; KnowFlow and Apple stay in Latin script; every string
passes the app's wording rule (`kfWording`, scripts/lib/app-wording.mjs): no
plan, subscription, upgrade, premium, Pro, price, free or checkout word, no
باقة, اشتراك, ترقية, مجان, سعر, احتراف, خطة or شهريا stem.

## Where they appear

The app only, shell 2 (`KnowFlowApp/2`) with the KnowFlowSpeech plugin present
(build 9 on). The web, build 8 and the Android shell show none of the UI
strings. The privacy sentence is on /privacy for everyone (web and app).

## Points for the owner

1. **One change from the study's text:** the Arabic microphone purpose string
   names the tab as the student sees it, «اسأل» (`nav.agent`), not "صفحة
   الأسئلة". The English keeps "Ask", which is the tab's English name.
2. **The privacy page is English in both locales today** (the camera sentence
   is too). The English sentence is added to the page, so /en/privacy and
   /ar/privacy both show it; the Arabic sentence below waits for an Arabic
   privacy page.
3. **`seconds`** is the counter beside "Listening", e.g. "12 s" / "12 ث".
4. **The language chip** shows the language the next words are heard in; it
   starts from the screen's language (ar -> Arabic, Saudi Arabia `ar-SA`;
   en -> English, United States `en-US`). Moroccan Arabic (`ar-MA`) is not a
   recognition language Apple lists, to my knowledge (unverified): Darija
   quality is the TestFlight go/no-go gate in the study, section 8.

## The UI strings (`dashboard.agent.voice`)

| Key | Where | en | ar |
|---|---|---|---|
| `start` | The microphone button's name (VoiceOver) | Speak your question | انطق سؤالك |
| `stop` | The button's name while listening | Stop | إيقاف |
| `listening` | The line above the field while listening | Listening. Tap to stop. | أستمع إليك. اضغط للإيقاف. |
| `seconds` | The counter in that line; {n} in Western digits | {n} s | {n} ث |
| `langAr` | The language chip, Arabic | Arabic | العربية |
| `langEn` | The language chip, English | English | الإنجليزية |
| `check` | After a take, the text is in the field | Check the text, then send it. | راجع النص ثم أرسله. |
| `denied` | A permission refused | KnowFlow cannot hear you. Allow the microphone and speech recognition for KnowFlow in Settings, then try again. | لا يستطيع KnowFlow سماعك. اسمح بالميكروفون والتعرف على الكلام لتطبيق KnowFlow في الإعدادات، ثم حاول مرة أخرى. |
| `openSettings` | The button beside `denied` | Open Settings | فتح الإعدادات |
| `noSpeech` | A take with no words | No words were heard. Try again a little closer to the phone. | لم تُسمع أي كلمات. حاول مرة أخرى وأنت أقرب إلى الهاتف. |
| `unsupported` | The language cannot be recognised on this phone | Speaking is not available in this language on your phone. You can type your question. | النطق غير متاح بهذه اللغة على هاتفك. يمكنك كتابة سؤالك. |
| `failed` | The recognizer failed and heard nothing | Your words could not be turned into text. Try again, or type your question. | تعذّر تحويل كلامك إلى نص. حاول مرة أخرى أو اكتب سؤالك. |
| `limit` | The take reached 60 s; the text is in the field | Stopped after 60 seconds. Check the text, then send it. | توقف التسجيل بعد 60 ثانية. راجع النص ثم أرسله. |

## The system's permission alerts (Info.plist, InfoPlist.strings)

| Key | en | ar |
|---|---|---|
| `NSMicrophoneUsageDescription` | KnowFlow uses the microphone only when you tap the microphone in Ask, to turn your spoken question into text you can edit before sending. | يستخدم KnowFlow الميكروفون فقط عندما تضغط على زر الميكروفون في «اسأل»، ليحوّل سؤالك المنطوق إلى نص يمكنك تعديله قبل إرساله. |
| `NSSpeechRecognitionUsageDescription` | Apple speech recognition turns your spoken question into text, on your phone when it can. KnowFlow never keeps the recording. | يحوّل التعرف على الكلام من Apple سؤالك المنطوق إلى نص، على هاتفك متى أمكن. لا يحتفظ KnowFlow بالتسجيل أبدًا. |

## The privacy page

| Where | en | ar |
|---|---|---|
| Privacy page sentence | When you speak a question in the app, Apple speech recognition turns it into text, on your phone when it can and otherwise on Apple's servers. KnowFlow receives only the text you choose to send, never the recording. | عندما تنطق سؤالًا في التطبيق، يحوّله التعرف على الكلام من Apple إلى نص، على هاتفك متى أمكن، وإلا فعلى خوادم Apple. لا يتلقى KnowFlow إلا النص الذي تختار إرساله، ولا يتلقى التسجيل أبدًا. |
