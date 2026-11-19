# Arabic copy, app v13: voice input in Ask (PR #340)

**APPROVED by the owner 2026-11-19.** Sixteen entries: the 13 keys of `dashboard.agent.voice`, the two iOS permission texts (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) and the privacy page sentence (`privacy.voice`). Copied byte for byte by script from the owner's approved set (`voice_strings_approved.md`, sha256 `cd00e5eb527955135b86fd7905d345ec7b512d09222d67e4f67ed2c4182f9e6f`), replacing the drafts of `docs/copy-drafts/voice_input_v1.md` (now a pointer here).

Where they show: the app only, shell 2 (`KnowFlowApp/2`) with the KnowFlowSpeech plugin present (build 9 on), in Ask (`src/components/agent/VoiceButton.tsx`). The web, build 8 and the Android shell show none of the UI strings. The permission texts are the system alerts: English in `ios/App/App/Info.plist` and `en.lproj/InfoPlist.strings`, Arabic in `ar.lproj/InfoPlist.strings`. The English privacy sentence is on /privacy for everyone (the page is English in both locales); the Arabic one is stored here for the future Arabic privacy page and is not shown. `{n}` is a Western-digit count of seconds. Every key was a DRAFT wired for review and never approved before this batch, so the "Old Arabic" column says "(new key)"; `scripts/verify-arabic-copy.mjs` asserts the new value, and `scripts/verify-voice-input.mjs` (section 5) holds the English, the permission texts and the privacy sentence to this file.

English (`src/lib/i18n/locales/en.ts`):

- `dashboard.agent.voice.start`: Ask with your voice
- `dashboard.agent.voice.stop`: Stop
- `dashboard.agent.voice.listening`: Listening. Tap to stop.
- `dashboard.agent.voice.seconds`: {n} s
- `dashboard.agent.voice.langAr`: Arabic
- `dashboard.agent.voice.langEn`: English
- `dashboard.agent.voice.check`: Check the text, then send it.
- `dashboard.agent.voice.denied`: KnowFlow cannot hear you. Allow it to use the microphone and speech recognition in Settings, then try again.
- `dashboard.agent.voice.openSettings`: Open Settings
- `dashboard.agent.voice.noSpeech`: No words were heard. Try again a little closer to the phone.
- `dashboard.agent.voice.unsupported`: Your phone cannot turn speech into text in this language. You can type your question.
- `dashboard.agent.voice.failed`: Your words could not be turned into text. Try again, or type your question.
- `dashboard.agent.voice.limit`: Stopped after 60 seconds. Check the text, then send it.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.agent.voice.start` | اسأل بصوتك | (new key) |
| `dashboard.agent.voice.stop` | إيقاف | (new key) |
| `dashboard.agent.voice.listening` | جارٍ الاستماع. اضغط للإيقاف. | (new key) |
| `dashboard.agent.voice.seconds` | {n} ث | (new key, carries {n}) |
| `dashboard.agent.voice.langAr` | العربية | (new key) |
| `dashboard.agent.voice.langEn` | الإنجليزية | (new key) |
| `dashboard.agent.voice.check` | راجع النص ثم أرسله. | (new key) |
| `dashboard.agent.voice.denied` | لا يستطيع KnowFlow سماعك. اسمح له باستخدام الميكروفون والتعرف على الكلام من الإعدادات، ثم حاول مجددًا. | (new key) |
| `dashboard.agent.voice.openSettings` | افتح الإعدادات | (new key) |
| `dashboard.agent.voice.noSpeech` | لم يُسمع أي كلام. حاول مجددًا وأنت أقرب إلى الهاتف. | (new key) |
| `dashboard.agent.voice.unsupported` | لا يدعم هاتفك تحويل الكلام إلى نص بهذه اللغة. يمكنك كتابة سؤالك. | (new key) |
| `dashboard.agent.voice.failed` | تعذّر تحويل كلامك إلى نص. حاول مجددًا أو اكتب سؤالك. | (new key) |
| `dashboard.agent.voice.limit` | توقف التسجيل بعد 60 ثانية. راجع النص ثم أرسله. | (new key) |

## Not dictionary keys

The iOS permission texts and the privacy sentence, one line per language. `(en)` is in `Info.plist` and `en.lproj/InfoPlist.strings` (the privacy one in `src/app/[locale]/(site)/privacy/page.tsx`, with `'` written `&apos;`); `(ar)` is in `ar.lproj/InfoPlist.strings` (the privacy one is not shown yet).

- `NSMicrophoneUsageDescription` (en): KnowFlow uses the microphone only when you tap the microphone in Ask, to turn your spoken question into text you can edit before sending.
- `NSMicrophoneUsageDescription` (ar): يستخدم KnowFlow الميكروفون فقط عندما تضغط على زر الميكروفون في «اسأل»، ليحوّل سؤالك المنطوق إلى نص يمكنك تعديله قبل إرساله.
- `NSSpeechRecognitionUsageDescription` (en): Apple's speech recognition turns your spoken question into text, on your phone when it can. KnowFlow never keeps the recording.
- `NSSpeechRecognitionUsageDescription` (ar): تحوّل خدمة Apple للتعرف على الكلام سؤالك المنطوق إلى نص، على هاتفك متى أمكن. لا يحتفظ KnowFlow بالتسجيل أبدًا.
- `privacy.voice` (en): When you ask with your voice in the app, Apple's speech recognition turns your question into text, on your phone when it can and otherwise on Apple's servers. KnowFlow receives only the text you choose to send, never the recording.
- `privacy.voice` (ar): عندما تسأل بصوتك في التطبيق، تحوّل خدمة Apple للتعرف على الكلام سؤالك إلى نص، على هاتفك متى أمكن، وإلا فعلى خوادم Apple. لا يتلقى KnowFlow إلا النص الذي تختار إرساله، ولا يتلقى التسجيل أبدًا.
