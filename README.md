# KnowFlow

> Arabic-first study app: ask questions about your own course files.

[![Live Demo](https://img.shields.io/badge/Demo-tryknowflow.com-green)](https://tryknowflow.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Claude API](https://img.shields.io/badge/Claude-Haiku-orange)](https://anthropic.com)

Students upload their course files (PDF, DOCX, PPTX), ask questions in Arabic
or English, and get answers that name the source file, plus summaries and
5-question quizzes.

## Where to get it

- iOS: [App Store](https://apps.apple.com/us/app/knowflow-study-your-notes/id6820418649?uo=4)
- Web: [tryknowflow.com](https://tryknowflow.com)

## Features

- Sign-in with email, Google or Apple
- Subjects and materials; upload of PDF, DOCX and PPTX
- Answers grounded in your files, naming the source file
- Summaries and 5-question quizzes
- Study streak and local study reminders
- Usage limits, rate limiting and an AI-consent screen
- Account deletion
- Scanned PDFs with no text layer are detected and the student is told how to get the text (there is no OCR)

## Stack

`Next.js 15` · `React 19` · `TypeScript` · `Tailwind (RTL)` · `Supabase` · `FastAPI` · `Claude Haiku 4.5` · `Voyage embeddings` · `Capacitor (iOS)` · `Railway` · `Vercel`

## Architecture

```
iOS app (Capacitor shell) / browser
  -> Next.js on Vercel (UI and API routes; questions, summaries and quizzes call Claude Haiku)
       -> Python FastAPI ingestion service on Railway (services/ingestion: markitdown text extraction, Voyage embeddings)
       -> Supabase (auth and Postgres)
```

## Run locally

```bash
# Web app (repo root)
npm install && npm run dev

# Ingestion service
cd services/ingestion && pip install -r requirements.txt
uvicorn main:app --reload
```

Environment variable names are listed in `.env.example`.

## Built by

[Abdelfettah Amellah](https://github.com/tornidomaroc-web) — Full Stack AI Engineer, Marrakesh 🇲🇦
